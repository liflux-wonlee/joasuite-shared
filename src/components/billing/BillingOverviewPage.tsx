import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import {
  CalendarClock,
  CreditCard,
  Gift,
  Package,
  Receipt,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useJoaSuite } from "../../context";
import { PlansSection } from "./PlansSection";

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

type AlertTone = "warning" | "danger" | "info";
type AlertCard = { id: string; tone: AlertTone; icon: any; title: string; body: string };

export function BillingOverviewPage() {
  const { t } = useTranslation();
  const { useAuth, router, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Link } = router;

  const overviewQ = useQuery({
    queryKey: ["billing-overview", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.getBillingOverview({ tenant_id: currentTenantId! }),
  });
  const bundleRulesQ = useQuery({
    queryKey: ["billing-bundle-rules"],
    queryFn: () => fns.listActiveBundleRules(),
  });

  const { multiAppDiscount, matchingRule, discountPct, discountCents, rules, paidCount } = useMemo(() => {
    const subs = (overviewQ.data?.subscriptions ?? []) as any[];
    const paidApps = subs.filter((s) => s.plan_code && s.plan_code !== "free");
    const rules = (bundleRulesQ.data ?? []) as Array<{ id: string; name: string; minimum_active_apps: number; discount_percent: number }>;
    const matchingRule = rules
      .filter((r) => paidApps.length >= r.minimum_active_apps)
      .sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
    const discountPct = matchingRule ? Number(matchingRule.discount_percent) : 0;
    const subtotalCents = overviewQ.data?.next_invoice_estimate_cents ?? 0;
    const discountCents = Math.round(subtotalCents * (discountPct / 100));
    return { multiAppDiscount: discountCents > 0, matchingRule, discountPct, discountCents, rules, paidCount: paidApps.length };
  }, [overviewQ.data, bundleRulesQ.data]);

  if (!currentTenantId) return null;
  if (overviewQ.isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!overviewQ.data) return null;

  const data = overviewQ.data;
  const subs = data.subscriptions ?? [];

  // Trial info for alerts
  const trialing = subs.filter((s: any) => s.status === "trialing" && s.trial_end);
  const soonestTrialEnd = trialing
    .map((s: any) => s.trial_end)
    .filter(Boolean)
    .sort()[0];
  const trialDaysLeft = soonestTrialEnd
    ? Math.ceil((new Date(soonestTrialEnd).getTime() - Date.now()) / 86_400_000)
    : null;

  // Alerts
  const alerts: AlertCard[] = [];
  alerts.push({
    id: "stripe",
    tone: "info",
    icon: Sparkles,
    title: t("billing.alert.stripe_pending_title", "Stripe not connected yet"),
    body: t(
      "billing.alert.stripe_pending_body",
      "Real payments are disabled. All charges and plan changes on this page are simulated for preview.",
    ),
  });
  if (!data.default_payment_method) {
    alerts.push({
      id: "no_pm",
      tone: "warning",
      icon: CreditCard,
      title: t("billing.alert.no_pm_title", "Payment method missing"),
      body: t(
        "billing.alert.no_pm_body",
        "Add a payment method to avoid service interruption when Stripe goes live.",
      ),
    });
  }
  if (trialDaysLeft !== null && trialDaysLeft <= 7) {
    alerts.push({
      id: "trial",
      tone: "warning",
      icon: CalendarClock,
      title: t("billing.alert.trial_ending_title", "Trial ending soon"),
      body: t("billing.alert.trial_ending_body", "Your trial ends in {{days}} day(s). Choose a plan to keep access.", { days: Math.max(0, trialDaysLeft) }),
    });
  }
  if (subs.some((s: any) => s.status === "past_due")) {
    alerts.push({
      id: "past_due",
      tone: "danger",
      icon: ShieldAlert,
      title: t("billing.alert.past_due_title", "Payment past due"),
      body: t("billing.alert.past_due_body", "One or more subscriptions are past due. Update your payment method to restore service."),
    });
  }
  if (subs.some((s: any) => s.status === "canceled" || s.cancel_at_period_end)) {
    alerts.push({
      id: "canceled",
      tone: "warning",
      icon: XCircle,
      title: t("billing.alert.canceled_title", "Subscription canceled"),
      body: t("billing.alert.canceled_body", "One or more subscriptions are scheduled to end. Re-subscribe to keep access."),
    });
  }

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alerts.map((a) => {
            const Icon = a.icon;
            const tone =
              a.tone === "danger"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : a.tone === "warning"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  : "border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200";
            return (
              <div key={a.id} className={`rounded-md border px-3 py-2.5 text-xs flex items-start gap-2 ${tone}`}>
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-semibold">{a.title}</div>
                  <div className="opacity-90">{a.body}</div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Apps & Plans */}
      <section>
        <header className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          <h3 className="font-medium">{t("billing.apps_and_plans", "Apps & Plans")}</h3>
        </header>
        <PlansSection />
      </section>


      {/* Discounts summary */}
      <section className="border rounded-lg bg-card">
        <header className="p-4 border-b flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Gift className="h-4 w-4" />
            {t("billing.discounts_summary", "Discounts")}
          </h3>
          <Link to="/app/account/billing/discounts" className="text-xs text-primary hover:underline">
            {t("billing.manage", "Manage")}
          </Link>
        </header>
        <ul className="divide-y text-sm">
          {multiAppDiscount && matchingRule && (
            <li className="p-4 flex items-center justify-between">
              <span>
                {t("billing.multi_app_discount", "Multi-app bundle discount")}
                <span className="text-xs text-muted-foreground ml-2">({matchingRule.name})</span>
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">−{discountPct}%</span>
            </li>
          )}
          <li className="p-4 flex items-center justify-between">
            <span>
              {t("billing.promo_code", "Promo code")}:{" "}
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">WELCOME20</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {t("billing.promo_simulated", "Simulated — Stripe coming later")}
            </span>
          </li>
          {(() => {
            const nextRule = rules
              .filter((r) => r.minimum_active_apps > paidCount)
              .sort((a, b) => a.minimum_active_apps - b.minimum_active_apps)[0];
            if (!nextRule) return null;
            const need = nextRule.minimum_active_apps - paidCount;
            return (
              <li className="p-4 text-xs text-muted-foreground">
                {t("billing.multi_app_hint_dynamic", "Add {{n}} more paid app(s) to unlock {{pct}}% off ({{name}}).", {
                  n: need, pct: Number(nextRule.discount_percent), name: nextRule.name,
                })}
              </li>
            );
          })()}
        </ul>
      </section>

      {/* Recent invoices shortcut */}
      <section className="border rounded-lg bg-card p-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <span>{t("billing.invoices_shortcut", "View invoices & receipts for this organization")}</span>
        </div>
        <Link to="/app/account/billing/invoices" className="text-xs text-primary hover:underline">
          {t("billing.open", "Open")}
        </Link>
      </section>
    </div>
  );
}
