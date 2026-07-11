import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { listAccountsWithBalance } from "@/lib/accounting.functions";
import { listParties, listCurrencies, listCategories } from "@/lib/admin.functions";
import { AddVendorDialog } from "@/components/AddVendorDialog";
import { previewOccurrenceDates } from "@/lib/recurring-preview";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Snap a date to nearest 1st or 15th on/after the given date (for semi_monthly).
function snapSemiMonthly(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  if (day === 1 || day === 15) return iso;
  if (day < 15) d.setUTCDate(15);
  else d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
function weekdayLabel(iso: string | null, t: (k: string, d?: any) => string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  const key = WEEKDAY_KEYS[d.getUTCDay()];
  const fallback = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getUTCDay()];
  return t(`common.weekday_${key}`, fallback);
}


export type RecurringFormValue = {
  name: string;
  direction: "money_in" | "money_out";
  type: string;
  category_id: string | null;
  party_id: string | null;
  description: string | null;
  status: "active" | "paused" | "ended" | "draft" | "needs_review" | "cancel_planned" | "cancelled";
  amount_type: "fixed" | "estimated" | "variable" | "range" | "historical_average" | "same_month_last_year" | "custom_plan" | "budget" | "manual";
  amount: number | null;
  amount_min: number | null;
  amount_max: number | null;
  currency_code: string;
  forecast_method: "manual" | "fixed" | "last_txn" | "avg_3m" | "avg_6m" | "same_month_last_year" | "max_6m" | "range" | "ai" | "custom_plan";
  forecast_confidence: "high" | "medium" | "low" | "uncertain";
  frequency: "one_time" | "weekly" | "biweekly" | "semi_monthly" | "monthly" | "quarterly" | "yearly" | "custom" | "irregular";
  start_date: string | null;
  next_date: string | null;
  end_date: string | null;
  due_day: number | null;
  autopay: boolean;
  payment_method: string | null;
  payment_account_id: string | null;
  stage: "forecast" | "committed" | "billed" | "paid";
  priority: "critical" | "high" | "normal" | "low" | "optional";
  forecast_included: boolean;
  auto_renew: boolean;
  renewal_date: string | null;
  cancellation_deadline: string | null;
  must_pay_by: string | null;
  can_defer: boolean;
  plan_lines: PlanLine[];
};

export type PlanLine = {
  line_no: number;
  due_date: string;
  amount: number;
  note?: string | null;
};

const DEFAULTS: RecurringFormValue = {
  name: "",
  direction: "money_out",
  type: "subscription",
  category_id: null,
  party_id: null,
  description: null,
  status: "active",
  amount_type: "fixed",
  amount: 0,
  amount_min: null,
  amount_max: null,
  currency_code: "USD",
  forecast_method: "fixed",
  forecast_confidence: "medium",
  frequency: "monthly",
  start_date: new Date().toISOString().slice(0, 10),
  next_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  due_day: null,
  autopay: false,
  payment_method: null,
  payment_account_id: null,
  stage: "forecast",
  priority: "normal",
  forecast_included: true,
  auto_renew: false,
  renewal_date: null,
  cancellation_deadline: null,
  must_pay_by: null,
  can_defer: false,
  plan_lines: [],
};

export function makeRecurringDefaults(over: Partial<RecurringFormValue> = {}): RecurringFormValue {
  // Only copy keys that belong to RecurringFormValue and have a non-undefined value.
  // Prevents stray DB columns (id, tenant_id, created_at, joined relations, etc.)
  // from leaking into form state and later being POSTed as part of the patch.
  const allowed = Object.keys(DEFAULTS) as (keyof RecurringFormValue)[];
  const clean: Partial<RecurringFormValue> = {};
  for (const k of allowed) {
    const val = (over as any)[k];
    if (val !== undefined) (clean as any)[k] = val;
  }
  return { ...DEFAULTS, ...clean };
}

export function RecurringForm({
  tenantId,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  tenantId: string;
  initial?: Partial<RecurringFormValue>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (v: RecurringFormValue) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState<RecurringFormValue>(makeRecurringDefaults(initial));
  useEffect(() => { if (initial) setV(makeRecurringDefaults(initial)); }, [initial?.name]); // eslint-disable-line

  const qc = useQueryClient();
  const listPartiesFn = useServerFn(listParties);
  const listCurrenciesFn = useServerFn(listCurrencies);
  const listAccountsFn = useServerFn(listAccountsWithBalance);
  const listCategoriesFn = useServerFn(listCategories);
  const partiesQ = useQuery({
    queryKey: ["parties-all", tenantId],
    enabled: !!tenantId,
    queryFn: () => listPartiesFn({ data: { tenant_id: tenantId, kind: "all" } }),
  });
  const categoriesQ = useQuery({
    queryKey: ["categories", tenantId],
    enabled: !!tenantId,
    queryFn: () => listCategoriesFn({ data: { tenant_id: tenantId } }),
  });
  const currenciesQ = useQuery({
    queryKey: ["currencies", tenantId],
    enabled: !!tenantId,
    queryFn: () => listCurrenciesFn({ data: { tenant_id: tenantId } }),
  });
  const accountsQ = useQuery({
    queryKey: ["payment-accounts", tenantId],
    enabled: !!tenantId,
    queryFn: () => listAccountsFn({ data: { tenant_id: tenantId } }),
  });
  type PartyOpt = { id: string; name_en: string; nick_name?: string | null; is_vendor?: boolean | null; is_customer?: boolean | null };
  const parties = (partiesQ.data ?? []) as PartyOpt[];
  const partyList = parties.filter((p) =>
    v.direction === "money_out" ? p.is_vendor : v.direction === "money_in" ? p.is_customer : true,
  );
  type CurrencyOpt = { code: string; symbol?: string | null; active?: boolean | null };
  const currencies = ((currenciesQ.data ?? []) as CurrencyOpt[]).filter((c) => c.active !== false);
  type AccountOpt = { id: string; account_name: string; account_type?: string | null; bank_name?: string | null; last4?: string | null; active?: boolean | null };
  const accounts = (((accountsQ.data as { rows?: AccountOpt[] } | undefined)?.rows) ?? []).filter((a) => a.active !== false);
  type CategoryOpt = { id: string; name: string; type?: string | null; active?: boolean | null };
  const categories = ((categoriesQ.data ?? []) as CategoryOpt[]).filter((c) => c.active !== false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  // Custom type list persisted per-tenant in localStorage so newly added types
  // remain selectable on subsequent visits within the same browser.
  const BUILTIN_TYPES = ["subscription","utility","insurance","rent","lease","loan_payment","interest","payroll","wage","tax","fee","maintenance","advertising","software","professional_service","budget","recurring_income","other_expense","other_income"];
  const typesStorageKey = `joabooks.recurring.types.${tenantId}`;
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(typesStorageKey);
      if (raw) setCustomTypes(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [typesStorageKey]);
  const allTypes = useMemo(() => {
    const merged = [...BUILTIN_TYPES, ...customTypes];
    if (v.type && !merged.includes(v.type)) merged.push(v.type);
    return Array.from(new Set(merged));
  }, [customTypes, v.type]);
  const handleTypeChange = (val: string) => {
    if (val === "__add_new__") {
      const name = window.prompt(t("recurring.add_type_prompt", "New type name"))?.trim();
      if (!name) return;
      const key = name.toLowerCase().replace(/\s+/g, "_");
      if (!customTypes.includes(key) && !BUILTIN_TYPES.includes(key)) {
        const next = [...customTypes, key];
        setCustomTypes(next);
        try { localStorage.setItem(typesStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      }
      set("type", key);
      return;
    }
    set("type", val);
  };

  const set = <K extends keyof RecurringFormValue>(k: K, val: RecurringFormValue[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  // When user switches to semi_monthly, snap start/next dates to 1st or 15th once.
  useEffect(() => {
    if (v.frequency !== "semi_monthly") return;
    const patch: Partial<RecurringFormValue> = {};
    if (v.start_date) {
      const snapped = snapSemiMonthly(v.start_date);
      if (snapped !== v.start_date) patch.start_date = snapped;
    }
    if (v.next_date) {
      const snapped = snapSemiMonthly(v.next_date);
      if (snapped !== v.next_date) patch.next_date = snapped;
    }
    if (Object.keys(patch).length > 0) {
      setV((s) => ({ ...s, ...patch }));
      toast.info(t("recurring.semi_monthly_snapped", "Semi-monthly runs on the 1st and 15th. Dates were adjusted."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.frequency]);

  // Helper text describing the cadence rule for the chosen frequency.
  const cadenceHint = (() => {
    const f = v.frequency;
    const sd = v.start_date;
    if (f === "semi_monthly") return t("recurring.hint_semi_monthly", "Runs on the 1st and 15th of every month.");
    if (f === "weekly" && sd) return t("recurring.hint_weekly", "Repeats every {{day}} (based on Start date).", { day: weekdayLabel(sd, t) });
    if (f === "biweekly" && sd) return t("recurring.hint_biweekly", "Repeats every other {{day}}.", { day: weekdayLabel(sd, t) });
    if (f === "monthly" && sd) {
      const day = v.due_day ?? new Date(sd + "T00:00:00Z").getUTCDate();
      return t("recurring.hint_monthly", "Repeats on day {{day}} of every month.", { day });
    }
    if (f === "quarterly") return t("recurring.hint_quarterly", "Repeats every 3 months on the same day.");
    if (f === "yearly") return t("recurring.hint_yearly", "Repeats every year on the same month and day.");
    return "";
  })();

  const handleDateChange = (key: "start_date" | "next_date", value: string) => {
    if (!value) { set(key, null); return; }
    if (v.frequency === "semi_monthly") {
      const snapped = snapSemiMonthly(value);
      if (snapped !== value) {
        toast.info(t("recurring.semi_monthly_snapped_to", "Adjusted to {{date}} (Semi-monthly uses the 1st and 15th).", { date: snapped }));
      }
      set(key, snapped);
      return;
    }
    set(key, value);
  };

  const hasValidAmount = v.amount_type === "range"
    ? Number(v.amount_min ?? 0) > 0 && Number(v.amount_max ?? 0) > 0
    : Number(v.amount ?? 0) > 0;
  const hasValidStartDate = v.frequency === "custom" || !!v.start_date;
  const isValid = !!v.name && !!v.direction && !!v.type && !!v.category_id
    && !!v.frequency && hasValidAmount && hasValidStartDate;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => { e.preventDefault(); onSubmit(v); }}
    >
      <FormSection title={t("recurring.section_basic", "Basic information")} columns="md:grid-cols-3">
        <div className="md:col-span-3">
          <Label>{t("recurring.label_title", "Title")} *</Label>
          <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div>
          <Label>{t("recurring.direction", "Direction")} *</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.direction} required
            onChange={(e) => set("direction", e.target.value as any)}>
            <option value="money_out">{t("recurring.money_out", "Money Out")}</option>
            <option value="money_in">{t("recurring.money_in", "Money In")}</option>
          </select>
        </div>
        <div>
          <Label>{t("recurring.type", "Type")} *</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.type} required onChange={(e) => handleTypeChange(e.target.value)}>
            {allTypes.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
            <option value="__add_new__">＋ {t("recurring.add_new_type", "Add new type…")}</option>
          </select>
        </div>
        <div>
          <Label>{t("recurring.category", "Transaction Category")} *</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.category_id ?? ""} required
            onChange={(e) => set("category_id", e.target.value || null)}>
            <option value="" disabled>{t("recurring.category_placeholder", "Select category…")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <Label>
              {v.direction === "money_in"
                ? t("recurring.party_customer", "Party (Customer)")
                : t("recurring.party_vendor", "Party (Vendor)")}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setAddVendorOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {v.direction === "money_in"
                ? t("recurring.new_customer", "New Customer")
                : t("recurring.new_party", "New Party")}
            </Button>
          </div>
          <select
            className="w-full border rounded h-9 px-2 bg-background"
            value={v.party_id ?? ""}
            onChange={(e) => set("party_id", e.target.value || null)}
          >
            <option value="">—</option>
            {partyList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_en}
                {p.nick_name ? ` (${p.nick_name})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <Label>{t("recurring.description", "Description")}</Label>
          <Textarea rows={2} value={v.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
        </div>
      </FormSection>

      <AddVendorDialog
        tenantId={tenantId}
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        onCreated={async (newId) => {
          await qc.refetchQueries({ queryKey: ["parties-all", tenantId] });
          set("party_id", newId);
        }}
      />

      <FormSection title={t("recurring.section_money", "Money & account")} columns="md:grid-cols-3">
        <div>
          <LabelWithInfo
            label={t("recurring.amount_type", "Amount Type")}
            title={t("recurring.amount_type_info_title", "What is Amount Type?")}
          >
            <p>{t("recurring.amount_type_info_desc", "How the charge amount is determined for each occurrence.")}</p>
            <ul className="space-y-1">
              <li><b>fixed</b> — {t("recurring.at_fixed", "Same amount every time.")}</li>
              <li><b>estimated</b> — {t("recurring.at_estimated", "Approximate; actual may vary slightly.")}</li>
              <li><b>variable</b> — {t("recurring.at_variable", "Changes each occurrence (e.g. utility bill).")}</li>
              <li><b>range</b> — {t("recurring.at_range", "Falls between a min and max amount.")}</li>
              <li><b>historical_average</b> — {t("recurring.at_hist", "Uses the average of past charges.")}</li>
              <li><b>same_month_last_year</b> — {t("recurring.at_smly", "Uses same month's amount from last year.")}</li>
              <li><b>custom_plan</b> — {t("recurring.at_custom", "Custom schedule with different amounts per date.")}</li>
              <li><b>budget</b> — {t("recurring.at_budget", "A planned budget cap, not a real bill.")}</li>
              <li><b>manual</b> — {t("recurring.at_manual", "You will enter the amount each time.")}</li>
            </ul>
          </LabelWithInfo>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.amount_type} onChange={(e) => set("amount_type", e.target.value as any)}>
            {["fixed","estimated","variable","range","historical_average","same_month_last_year","custom_plan","budget","manual"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        {v.amount_type === "range" ? (
          <>
            <div>
              <Label>{t("recurring.amount_min", "Min")} *</Label>
              <Input type="number" step="0.01" min="0.01" required value={v.amount_min ?? 0} onChange={(e) => set("amount_min", Number(e.target.value))} />
            </div>
            <div>
              <Label>{t("recurring.amount_max", "Max")} *</Label>
              <Input type="number" step="0.01" min="0.01" required value={v.amount_max ?? 0} onChange={(e) => set("amount_max", Number(e.target.value))} />
            </div>
          </>
        ) : (
          <div>
            <Label>{t("recurring.total_amount", "Total Amount")} *</Label>
            <Input type="number" step="0.01" min="0.01" required value={v.amount ?? 0} onChange={(e) => set("amount", Number(e.target.value))} />
          </div>
        )}
        <div>
          <Label>{t("recurring.currency", "Currency")}</Label>
          <select
            className="w-full border rounded h-9 px-2 bg-background"
            value={v.currency_code}
            onChange={(e) => set("currency_code", e.target.value)}
          >
            {currencies.length === 0 && <option value={v.currency_code}>{v.currency_code}</option>}
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
                {c.symbol ? ` (${c.symbol})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label>
            {v.direction === "money_in"
              ? t("recurring.receiving_account", "Receiving Account")
              : t("recurring.paying_account", "Paying Account")}
          </Label>
          <select
            className="w-full border rounded h-9 px-2 bg-background"
            value={v.payment_account_id ?? ""}
            onChange={(e) => set("payment_account_id", e.target.value || null)}
          >
            <option value="">—</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name}
                {a.bank_name ? ` · ${a.bank_name}` : ""}
                {a.last4 ? ` · ••••${a.last4}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <LabelWithInfo
            label={t("recurring.forecast_method", "Forecast Method")}
            title={t("recurring.forecast_method_info_title", "What is Forecast Method?")}
          >
            <p>{t("recurring.forecast_method_info_desc", "How the forecast graph estimates future amounts for this item. Amount Type is the actual charge; Forecast Method is how we project it.")}</p>
            <ul className="space-y-1">
              <li><b>manual</b> — {t("recurring.fm_manual", "You set future amounts yourself.")}</li>
              <li><b>fixed</b> — {t("recurring.fm_fixed", "Uses the fixed amount every period.")}</li>
              <li><b>last_txn</b> — {t("recurring.fm_last", "Uses the most recent actual transaction.")}</li>
              <li><b>avg_3m</b> — {t("recurring.fm_avg3", "Average of the last 3 months.")}</li>
              <li><b>avg_6m</b> — {t("recurring.fm_avg6", "Average of the last 6 months.")}</li>
              <li><b>same_month_last_year</b> — {t("recurring.fm_smly", "Same month from last year.")}</li>
              <li><b>max_6m</b> — {t("recurring.fm_max6", "Highest amount in the last 6 months (conservative).")}</li>
              <li><b>range</b> — {t("recurring.fm_range", "Uses the min–max range midpoint.")}</li>
              <li><b>ai</b> — {t("recurring.fm_ai", "AI-based prediction from history and patterns.")}</li>
              <li><b>custom_plan</b> — {t("recurring.fm_custom", "Uses the custom plan lines you defined.")}</li>
            </ul>
          </LabelWithInfo>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.forecast_method} onChange={(e) => set("forecast_method", e.target.value as any)}>
            {["manual","fixed","last_txn","avg_3m","avg_6m","same_month_last_year","max_6m","range","ai","custom_plan"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Label className="m-0">{t("recurring.confidence", "Confidence")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("recurring.confidence_info_aria", "What is Confidence?")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 text-xs space-y-2">
                <p className="font-medium text-sm">{t("recurring.confidence_info_title", "What is Confidence?")}</p>
                <p className="text-muted-foreground">
                  {t(
                    "recurring.confidence_info_desc",
                    "How certain the forecasted amount is likely to match the actual amount. Set higher when you have more historical data.",
                  )}
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.forecast_confidence} onChange={(e) => set("forecast_confidence", e.target.value as any)}>
            {["high","medium","low","uncertain"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </FormSection>

      <FormSection title={t("recurring.section_schedule", "Schedule")} columns="md:grid-cols-3">
        <div className="md:col-span-3">
          <Label>{t("recurring.frequency", "Frequency")} *</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.frequency} required onChange={(e) => set("frequency", e.target.value as any)}>
            {["one_time","weekly","biweekly","semi_monthly","monthly","quarterly","yearly","custom","irregular"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          {cadenceHint && <p className="text-xs text-muted-foreground mt-1">{cadenceHint}</p>}
        </div>
        {v.frequency === "custom" ? (
          <div className="md:col-span-3">
            <CustomPlanEditor
              lines={v.plan_lines}
              currency={v.currency_code}
              onChange={(lines) => set("plan_lines", lines)}
              embedded
            />
          </div>
        ) : (
          <>
            <div>
              <Label>{t("recurring.start_date", "Start Date")} *</Label>
              <Input type="date" required value={v.start_date ?? ""} onChange={(e) => handleDateChange("start_date", e.target.value)} />
            </div>
            <div>
              <Label>{t("recurring.next_date", "Next Date")}</Label>
              <Input type="date" value={v.next_date ?? ""} onChange={(e) => handleDateChange("next_date", e.target.value)} />
            </div>
            <div>
              <Label>{t("recurring.end_date", "End Date")}</Label>
              <Input type="date" value={v.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} />
            </div>
            <div>
              <Label>{t("recurring.due_day", "Due Day (1-31)")}</Label>
              <Input type="number" min={1} max={31} value={v.due_day ?? ""} onChange={(e) => set("due_day", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <Label>{t("recurring.must_pay_by", "Must Pay By")}</Label>
              <Input type="date" value={v.must_pay_by ?? ""} onChange={(e) => set("must_pay_by", e.target.value || null)} />
            </div>
          </>
        )}
      </FormSection>

      {v.frequency !== "custom" && v.amount_type === "custom_plan" && (
        <CustomPlanEditor
          lines={v.plan_lines}
          currency={v.currency_code}
          onChange={(lines) => set("plan_lines", lines)}
        />
      )}


      <FormSection title={t("recurring.section_lifecycle", "Lifecycle")} columns="md:grid-cols-3">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <Label className="m-0">{t("recurring.stage", "Stage")}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("recurring.stage_info_aria", "What is Stage?")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-72 text-xs space-y-2">
                <p className="font-medium text-sm">{t("recurring.stage_info_title", "Stage means…")}</p>
                <p className="text-muted-foreground">
                  {t(
                    "recurring.stage_info_desc",
                    "Where this recurring item is in its lifecycle. It moves left → right as the obligation becomes more concrete.",
                  )}
                </p>
                <ul className="space-y-1">
                  <li><b>forecast</b> — {t("recurring.stage_forecast", "Predicted only; not yet committed.")}</li>
                  <li><b>committed</b> — {t("recurring.stage_committed", "Contract or order is confirmed; invoice not received yet.")}</li>
                  <li><b>billed</b> — {t("recurring.stage_billed", "Invoice / bill received; payment pending.")}</li>
                  <li><b>paid</b> — {t("recurring.stage_paid", "Payment has been made.")}</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.stage} onChange={(e) => set("stage", e.target.value as any)}>
            {["forecast","committed","billed","paid"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1 block">{t("recurring.priority", "Priority")}</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.priority} onChange={(e) => set("priority", e.target.value as any)}>
            {["critical","high","normal","low","optional"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <Label className="mb-1 block">{t("recurring.status", "Status")}</Label>
          <select className="w-full border rounded h-9 px-2 bg-background"
            value={v.status} onChange={(e) => set("status", e.target.value as any)}>
            {["active","paused","ended","draft","needs_review","cancel_planned","cancelled"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      </FormSection>

      <FormSection
        title={t("recurring.section_controls", "Forecast & automation")}
        columns="sm:grid-cols-2 lg:grid-cols-4"
        infoTitle={t("recurring.section_controls_info_title", "Forecast & automation")}
        info={
          <>
            <p>{t("recurring.section_controls_info_desc", "Controls how this item behaves in forecasts and whether the system handles it automatically.")}</p>
            <ul className="space-y-1">
              <li><b>{t("recurring.forecast_included", "Include in forecast")}</b> — {t("recurring.ci_forecast_included", "Show this item in cashflow forecast charts and totals.")}</li>
              <li><b>{t("recurring.autopay", "Autopay")}</b> — {t("recurring.ci_autopay", "Payment is charged automatically by the vendor/bank on the due date.")}</li>
              <li><b>{t("recurring.auto_renew", "Auto Renew")}</b> — {t("recurring.ci_auto_renew", "Subscription/contract renews automatically after the end/renewal date.")}</li>
              <li><b>{t("recurring.can_defer", "Can Defer")}</b> — {t("recurring.ci_can_defer", "This payment can be postponed to a later period if cash is tight.")}</li>
            </ul>
          </>
        }
      >
        <ToggleField
          label={t("recurring.forecast_included", "Include in forecast")}
          checked={v.forecast_included}
          onCheckedChange={(checked) => set("forecast_included", checked)}
        />
        <ToggleField
          label={t("recurring.autopay", "Autopay")}
          checked={v.autopay}
          onCheckedChange={(checked) => set("autopay", checked)}
        />
        <ToggleField
          label={t("recurring.auto_renew", "Auto Renew")}
          checked={v.auto_renew}
          onCheckedChange={(checked) => set("auto_renew", checked)}
        />
        <ToggleField
          label={
            <span className="flex items-center gap-1">
              {t("recurring.can_defer", "Can Defer")}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("recurring.can_defer_info_aria", "What is Can Defer?")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-72 text-xs space-y-2">
                  <p className="font-medium text-sm">{t("recurring.can_defer_info_title", "What is Can Defer?")}</p>
                  <p className="text-muted-foreground">
                    {t(
                      "recurring.can_defer_info_desc",
                      "Whether this payment or income can be postponed to a later period. Turn on if, for example, a subscription can be deferred by one month.",
                    )}
                  </p>
                </PopoverContent>
              </Popover>
            </span>
          }
          checked={v.can_defer}
          onCheckedChange={(checked) => set("can_defer", checked)}
        />
      </FormSection>

      <FormSection title={t("recurring.section_renewal", "Renewal & cancellation")} columns="md:grid-cols-2">
        <div>
          <Label>{t("recurring.renewal_date", "Renewal Date")}</Label>
          <Input type="date" value={v.renewal_date ?? ""} onChange={(e) => set("renewal_date", e.target.value || null)} />
        </div>
        <div>
          <Label>{t("recurring.cancellation_deadline", "Cancellation Deadline")}</Label>
          <Input type="date" value={v.cancellation_deadline ?? ""} onChange={(e) => set("cancellation_deadline", e.target.value || null)} />
        </div>
      </FormSection>

      {/* Preview */}
      <OccurrencePreview v={v} />

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel", "Cancel")}</Button>}
        <Button type="submit" disabled={submitting || !isValid}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  columns,
  info,
  infoTitle,
  children,
}: {
  title: string;
  columns: string;
  info?: ReactNode;
  infoTitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <h2 className="text-base font-bold text-foreground flex items-center gap-1">
        {title}
        {info && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={infoTitle ?? title}
                className="text-muted-foreground hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-80 text-xs space-y-2">
              {infoTitle && <p className="font-medium text-sm">{infoTitle}</p>}
              <div className="text-muted-foreground space-y-2">{info}</div>
            </PopoverContent>
          </Popover>
        )}
      </h2>
      <div className={cn("grid grid-cols-1 gap-3", columns)}>{children}</div>
    </section>
  );
}

function LabelWithInfo({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <Label className="m-0">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={title}
            className="text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-80 text-xs space-y-2">
          <p className="font-medium text-sm">{title}</p>
          <div className="text-muted-foreground space-y-2">{children}</div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onCheckedChange,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function OccurrencePreview({ v }: { v: RecurringFormValue }) {
  const { t } = useTranslation();
  const dates = useMemo(() => previewOccurrenceDates({
    frequency: v.frequency,
    start_date: v.start_date,
    next_date: v.next_date,
    end_date: v.end_date,
    due_day: v.due_day,
    count: 6,
  }), [v.frequency, v.start_date, v.next_date, v.end_date, v.due_day]);

  if (dates.length === 0) return null;
  const amt = v.amount_type === "range"
    ? ((v.amount_min ?? 0) + (v.amount_max ?? 0)) / 2
    : (v.amount ?? 0);

  return (
    <section className="border rounded p-3 bg-muted/30">
      <div className="text-sm font-medium mb-2">
        {t("recurring.preview_title", "Next occurrences preview")}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {dates.map((d, i) => (
          <div key={d + i} className="border rounded px-2 py-1 bg-background">
            <div className="font-medium">{fmtDate(d)}</div>
            <div className="text-muted-foreground tabular-nums">
              {v.currency_code} {fmtMoney(amt)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {t("recurring.preview_hint", "Preview only — full 13-month schedule is generated after save.")}
      </p>
    </section>
  );
}

function CustomPlanEditor({
  lines,
  currency,
  onChange,
  embedded = false,
}: {
  lines: PlanLine[];
  currency: string;
  onChange: (lines: PlanLine[]) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const update = (idx: number, patch: Partial<PlanLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const add = () => {
    const nextNo = (lines[lines.length - 1]?.line_no ?? 0) + 1;
    onChange([
      ...lines,
      { line_no: nextNo, due_date: new Date().toISOString().slice(0, 10), amount: 0, note: "" },
    ]);
  };
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const Wrapper: any = embedded ? "div" : "section";
  return (
    <Wrapper className={embedded ? "space-y-3" : "rounded-lg border bg-muted/30 p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">
            {t("recurring.custom_plan_title", "Custom schedule")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "recurring.custom_plan_desc",
              "Add each planned payment with its own date and amount. Used when frequency is Custom or amount type is Custom plan.",
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          {t("recurring.add_plan_line", "Add line")}
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {t("recurring.no_plan_lines", "No plan lines yet. Click Add line to create a schedule.")}
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-1">
                <Label className="text-xs">#</Label>
                <Input
                  type="number"
                  min={1}
                  value={l.line_no}
                  onChange={(e) => update(i, { line_no: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">{t("recurring.due_date", "Due date")}</Label>
                <Input
                  type="date"
                  value={l.due_date}
                  onChange={(e) => update(i, { due_date: e.target.value })}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">
                  {t("recurring.amount", "Amount")} ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={l.amount}
                  onChange={(e) => update(i, { amount: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-4">
                <Label className="text-xs">{t("recurring.note", "Note")}</Label>
                <Input
                  value={l.note ?? ""}
                  onChange={(e) => update(i, { note: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                  ×
                </Button>
              </div>
            </div>
          ))}
          <div className="text-right text-sm border-t pt-2">
            <span className="text-muted-foreground">{t("recurring.plan_total", "Total")}: </span>
            <span className="font-medium tabular-nums">
              {currency} {fmtMoney(total)}
            </span>
          </div>
        </div>
      )}
    </Wrapper>
  );
}

