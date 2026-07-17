import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ticket, Tag, AlertTriangle, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

type Promo = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percent" | "fixed_amount" | "trial_extension" | "billing_credit";
  discount_value: number;
  currency: string | null;
  scope: "all_apps" | "specific_app" | "specific_plan";
  app_code: string | null;
  plan_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  computed_status: "active" | "upcoming" | "expired";
};

type TenantDiscount = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  discount_type: Promo["discount_type"];
  discount_value: number;
  currency: string | null;
  scope: Promo["scope"];
  app_code: string | null;
  plan_code: string | null;
  source: string;
  starts_at: string;
  ends_at: string | null;
  status: "active" | "upcoming" | "expired" | "canceled";
};

function statusBadge(s: string) {
  const m: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    upcoming: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    expired: "bg-muted text-muted-foreground",
    canceled: "bg-muted text-muted-foreground line-through",
  };
  return `text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${m[s] ?? m.expired}`;
}

type TFn = (k: string, d?: string) => string;

function formatDiscount(p: { discount_type: Promo["discount_type"]; discount_value: number; currency: string | null }, t: TFn) {
  switch (p.discount_type) {
    case "percent": return `${p.discount_value}% off`;
    case "fixed_amount": return `${p.currency ?? "USD"} ${p.discount_value} off`;
    case "trial_extension": return `+${p.discount_value} ${t("billing.discounts.trial_days", "trial days")}`;
    case "billing_credit": return `${p.discount_value} ${t("billing.discounts.months_credit", "months credit")}`;
  }
}

function formatScope(p: { scope: Promo["scope"]; app_code: string | null; plan_code: string | null }, t: TFn) {
  if (p.scope === "all_apps") return t("billing.discounts.scope.all", "All apps");
  if (p.scope === "specific_app") return `${t("billing.discounts.scope.app", "App")}: ${p.app_code ?? "—"}`;
  return `${t("billing.discounts.scope.plan", "Plan")}: ${p.app_code ?? "—"}/${p.plan_code ?? "—"}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export function BillingDiscountsPage() {
  const { t } = useTranslation();
  const { useAuth, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: perm } = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });

  const { data: promos = [], isLoading: promosLoading } = useQuery({
    queryKey: ["promo-codes", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.listAvailablePromotions({ tenant_id: currentTenantId! }) as Promise<Promo[]>,
  });

  const { data: discounts = [], isLoading: discountsLoading } = useQuery({
    queryKey: ["tenant-discounts", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.listTenantDiscounts({ tenant_id: currentTenantId! }) as Promise<TenantDiscount[]>,
  });

  const redeem = useMutation({
    mutationFn: (c: string) => fns.redeemPromoCode({ tenant_id: currentTenantId!, code: c }),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success(t("billing.discounts.applied", "Promo code applied"));
        setCode("");
        qc.invalidateQueries({ queryKey: ["tenant-discounts", currentTenantId] });
        qc.invalidateQueries({ queryKey: ["promo-codes", currentTenantId] });
      } else {
        const map: Record<string, string> = {
          not_found: t("billing.discounts.err.not_found", "Promo code not found"),
          expired: t("billing.discounts.err.expired", "This promo code has expired"),
          upcoming: t("billing.discounts.err.upcoming", "This promo code is not yet active"),
          exhausted: t("billing.discounts.err.exhausted", "This promo code has reached its limit"),
          already_applied: t("billing.discounts.err.already_applied", "This promo code is already applied"),
        };
        toast.error(map[res.reason] ?? "Unable to apply code");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fns.removeTenantDiscount({ tenant_id: currentTenantId!, discount_id: id }),
    onSuccess: () => {
      toast.success(t("billing.discounts.removed", "Discount removed"));
      qc.invalidateQueries({ queryKey: ["tenant-discounts", currentTenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const canManage = !!perm?.can_manage;
  const grouped = {
    active: promos.filter((p) => p.computed_status === "active"),
    upcoming: promos.filter((p) => p.computed_status === "upcoming"),
    expired: promos.filter((p) => p.computed_status === "expired"),
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("billing.discounts.stripe_note", "Promo codes are validated against local data only. Stripe coupon/promotion-code sync will be connected in a future phase.")}</span>
      </div>

      <div className="border rounded-lg bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Ticket className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{t("billing.discounts.redeem_title", "Redeem a code")}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {t("billing.discounts.redeem_desc", "Enter a promo code to apply a discount to this organization.")}
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) redeem.mutate(code.trim().toUpperCase()); }}
          className="flex gap-2 max-w-md"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PROMOCODE"
            className="flex-1 border rounded-md px-3 py-2 text-sm font-mono bg-background"
            disabled={!canManage || redeem.isPending}
          />
          <button
            type="submit"
            disabled={!canManage || redeem.isPending || !code.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {redeem.isPending ? "…" : t("billing.discounts.apply", "Apply")}
          </button>
        </form>
        {!canManage && (
          <p className="text-xs text-muted-foreground mt-2">{t("billing.discounts.manage_only", "Only billing admins can redeem promo codes.")}</p>
        )}
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{t("billing.discounts.your_discounts", "Active discounts for this organization")}</h3>
        </div>
        {discountsLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : discounts.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">{t("billing.discounts.none_applied", "No discounts applied yet.")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">{t("billing.discounts.name", "Name")}</th>
                <th className="px-3 py-2">{t("billing.discounts.type", "Type")}</th>
                <th className="px-3 py-2">{t("billing.discounts.amount", "Amount")}</th>
                <th className="px-3 py-2">{t("billing.discounts.applies_to", "Applies to")}</th>
                <th className="px-3 py-2">{t("billing.discounts.start", "Start")}</th>
                <th className="px-3 py-2">{t("billing.discounts.end", "End")}</th>
                <th className="px-3 py-2">{t("billing.status", "Status")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    {d.name}
                    {d.code && <span className="ml-2 font-mono text-xs text-muted-foreground">{d.code}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.discount_type}</td>
                  <td className="px-3 py-2">{formatDiscount(d, t as TFn)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatScope(d, t as TFn)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(d.starts_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(d.ends_at)}</td>
                  <td className="px-3 py-2"><span className={statusBadge(d.status)}>{d.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    {canManage && d.status === "active" && (
                      <button
                        onClick={() => remove.mutate(d.id)}
                        disabled={remove.isPending}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.remove", "Remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(["active", "upcoming", "expired"] as const).map((bucket) => (
        <div key={bucket} className="border rounded-lg bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">
              {bucket === "active" && t("billing.discounts.active_promos", "Active promotions")}
              {bucket === "upcoming" && t("billing.discounts.upcoming_promos", "Upcoming promotions")}
              {bucket === "expired" && t("billing.discounts.expired_promos", "Expired promotions")}
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">{grouped[bucket].length}</span>
          </div>
          {promosLoading ? (
            <div className="p-4 text-sm text-muted-foreground">{t("common.loading")}</div>
          ) : grouped[bucket].length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">—</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">{t("billing.discounts.code", "Code")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.name", "Name")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.type", "Type")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.amount", "Amount")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.applies_to", "Applies to")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.start", "Start")}</th>
                  <th className="px-3 py-2">{t("billing.discounts.end", "End")}</th>
                </tr>
              </thead>
              <tbody>
                {grouped[bucket].map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{p.code}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.discount_type}</td>
                    <td className="px-3 py-2">{formatDiscount(p, t as TFn)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatScope(p, t as TFn)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.starts_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.ends_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
