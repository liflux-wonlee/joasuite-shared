import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";
import { APP_DISPLAY } from "../../constants";

const PLAN_ORDER = ["free", "basic", "pro", "business"] as const;

function fmtMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
}

function planRank(code: string) {
  const idx = PLAN_ORDER.indexOf(code as (typeof PLAN_ORDER)[number]);
  return idx === -1 ? 99 : idx;
}

/**
 * Plan comparison for a single app. `appCode` is supplied by the host route
 * file's own `validateSearch` (each app's `/app/account/billing/compare`
 * route reads its own typed `app` search param and passes it down) —
 * this component can't call `useSearch()` itself since that hook is typed
 * to the host's own route tree.
 */
export function BillingComparePage({ appCode }: { appCode: string }) {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Link } = router;
  const { Button } = ui as any;
  const qc = useQueryClient();
  const [interval, setInterval] = useState<"month" | "year">("month");

  const plansQ = useQuery({
    queryKey: ["billing-plans", appCode],
    queryFn: () => fns.listBillingPlans({ app_code: appCode }),
  });
  const overviewQ = useQuery({
    queryKey: ["billing-overview", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.getBillingOverview({ tenant_id: currentTenantId! }),
  });
  const permQ = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });
  const canManage = !!permQ.data?.can_manage;

  const sub = (overviewQ.data?.subscriptions ?? []).find((s: any) => s.app_code === appCode);
  const currentPlan: string | undefined = sub?.plan_code;

  const grouped = useMemo(() => {
    const byPlan = new Map<string, { month?: any; year?: any }>();
    (plansQ.data ?? []).forEach((p: any) => {
      const slot = byPlan.get(p.plan_code) ?? {};
      slot[p.interval as "month" | "year"] = p;
      byPlan.set(p.plan_code, slot);
    });
    return Array.from(byPlan.entries())
      .filter(([code]) => code !== "free")
      .sort((a, b) => planRank(a[0]) - planRank(b[0]));
  }, [plansQ.data]);

  const change = useMutation({
    mutationFn: (input: { plan_code: string }) =>
      fns.changeSubscriptionPlan({
        tenant_id: currentTenantId!,
        app_code: appCode,
        plan_code: input.plan_code,
        interval,
        seats: 1,
      }),
    onSuccess: () => {
      toast.success(t("billing.plan_change_success", "Plan updated (simulated)"));
      qc.invalidateQueries({ queryKey: ["billing-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const meta = APP_DISPLAY.find((a) => a.code === appCode);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/app/account/billing"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("billing.back_to_plans", "Back to Apps & Plans")}
          </Link>
        </div>
        <div className="inline-flex border rounded-md overflow-hidden text-xs">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`px-3 py-1.5 ${interval === iv ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              {iv === "month" ? t("billing.monthly", "Monthly") : t("billing.yearly", "Yearly")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">
          {t("billing.compare_plans_for", "Compare plans for")} {meta?.name ?? appCode}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("billing.compare_desc", "Pick the plan that fits your team. Yearly billing saves ~15%.")}
        </p>
      </div>

      <div className="rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200 px-3 py-2 text-xs flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("billing.stripe_future_short", "Updates local data only — Stripe coming later.")}</span>
      </div>

      {plansQ.isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : grouped.length === 0 ? (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          {t("billing.no_plans", "No plans available for this app yet.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {grouped.map(([planCode, plans]) => {
            const p = plans[interval] ?? plans.month ?? plans.year;
            if (!p) return null;
            const isCurrent = currentPlan === planCode;
            const isUpgrade = currentPlan ? planRank(planCode) > planRank(currentPlan) : true;
            const isDowngrade = currentPlan ? planRank(planCode) < planRank(currentPlan) : false;
            const features: string[] = Array.isArray(p.features) ? p.features : [];
            const yearly = plans.year;
            const monthly = plans.month;

            return (
              <div
                key={planCode}
                className={`border rounded-lg p-5 flex flex-col bg-card relative ${
                  isCurrent ? "ring-2 ring-primary" : ""
                } ${planCode === "pro" ? "shadow-md" : ""}`}
              >
                {isCurrent && (
                  <span className="absolute -top-2 left-4 text-[10px] uppercase font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded">
                    {t("billing.current_plan", "Current plan")}
                  </span>
                )}
                {planCode === "pro" && !isCurrent && (
                  <span className="absolute -top-2 right-4 text-[10px] uppercase font-semibold bg-amber-500 text-white px-2 py-0.5 rounded">
                    {t("billing.popular", "Popular")}
                  </span>
                )}

                <div className="font-semibold text-lg capitalize">{p.name}</div>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                )}

                <div className="mt-4">
                  <div className="text-3xl font-semibold">{fmtMoney(p.price_cents)}</div>
                  <div className="text-xs text-muted-foreground">/ {p.interval}</div>
                  {interval === "month" && yearly && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      {t("billing.or_yearly", "or")} {fmtMoney(yearly.price_cents)} / {t("billing.year_short", "yr")}
                    </div>
                  )}
                  {interval === "year" && monthly && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {t("billing.equiv_monthly", "≈")} {fmtMoney(Math.round(yearly!.price_cents / 12))} /{" "}
                      {t("billing.month_short", "mo")}
                    </div>
                  )}
                </div>

                <ul className="text-sm space-y-1.5 mt-4 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {features.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      {t("billing.no_features", "No feature list yet.")}
                    </li>
                  )}
                </ul>

                <div className="mt-5">
                  {isCurrent ? (
                    <Button size="sm" variant="outline" disabled className="w-full">
                      {t("billing.current_plan", "Current plan")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={isUpgrade ? "default" : "outline"}
                      disabled={!canManage || change.isPending}
                      onClick={() => change.mutate({ plan_code: planCode })}
                      className="w-full gap-1.5"
                    >
                      {isUpgrade ? <ArrowUp className="h-3.5 w-3.5" /> : isDowngrade ? <ArrowDown className="h-3.5 w-3.5" /> : null}
                      {isUpgrade
                        ? t("billing.upgrade", "Upgrade")
                        : isDowngrade
                          ? t("billing.downgrade", "Downgrade")
                          : t("billing.select_plan", "Select")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
