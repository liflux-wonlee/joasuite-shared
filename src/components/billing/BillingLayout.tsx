import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, CalendarClock, CreditCard, Zap } from "lucide-react";
import { useJoaSuite } from "../../context";

type Tab = { to: string; key: string; exact?: boolean; activeBg: string; activeFg: string };
const TABS: Tab[] = [
  { to: "/app/account/billing", key: "plans", exact: true, activeBg: "#FDE8E8", activeFg: "#9B1C1C" },
  { to: "/app/account/billing/payment-methods", key: "payment_methods", activeBg: "#DCFCE7", activeFg: "#166534" },
  { to: "/app/account/billing/invoices", key: "invoices", activeBg: "#DBEAFE", activeFg: "#1E40AF" },
  { to: "/app/account/billing/discounts", key: "discounts", activeBg: "#FCE7F3", activeFg: "#9D174D" },
  { to: "/app/account/billing/referrals", key: "referrals", activeBg: "#EDE9FE", activeFg: "#5B21B6" },
  { to: "/app/account/billing/usage", key: "usage", activeBg: "#CFFAFE", activeFg: "#155E75" },
  { to: "/app/account/billing/details", key: "details", activeBg: "#FFEDD5", activeFg: "#9A3412" },
];

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  trialing: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  past_due: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  canceled: "bg-muted text-muted-foreground border-border",
  inactive: "bg-muted text-muted-foreground border-border",
  incomplete: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
};

function rollupStatus(subs: any[]): keyof typeof STATUS_TONE {
  if (!subs.length) return "inactive";
  const set = new Set(subs.map((s) => s.status));
  if (set.has("past_due")) return "past_due";
  if (set.has("active")) return "active";
  if (set.has("trialing")) return "trialing";
  if (set.has("canceled")) return "canceled";
  return "inactive";
}

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BillingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { useAuth, router, fns } = useJoaSuite();
  const { currentTenantId, currentMembership } = useAuth();
  const { Link, useNavigate, usePathname } = router;
  const nav = useNavigate();
  const path = usePathname();

  const { data: perm, isLoading } = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });

  const overviewQ = useQuery({
    queryKey: ["billing-overview", currentTenantId],
    enabled: !!currentTenantId && !!perm?.can_view,
    queryFn: () => fns.getBillingOverview({ tenant_id: currentTenantId! }),
  });
  const bundleRulesQ = useQuery({
    queryKey: ["billing-bundle-rules"],
    enabled: !!perm?.can_view,
    queryFn: () => fns.listActiveBundleRules(),
  });

  useEffect(() => {
    if (!isLoading && perm && !perm.can_view) {
      nav({ to: "/app/account" });
    }
  }, [isLoading, perm, nav]);

  const summary = useMemo(() => {
    const data = overviewQ.data;
    const subs = (data?.subscriptions ?? []) as any[];
    const status = rollupStatus(subs);
    const nextEnd = subs.map((s) => s.current_period_end).filter(Boolean).sort()[0];
    const paidApps = subs.filter((s) => s.plan_code && s.plan_code !== "free");
    const rules = (bundleRulesQ.data ?? []) as Array<{ minimum_active_apps: number; discount_percent: number }>;
    const matchingRule = rules
      .filter((r) => paidApps.length >= r.minimum_active_apps)
      .sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
    const discountPct = matchingRule ? Number(matchingRule.discount_percent) : 0;
    const subtotalCents = data?.next_invoice_estimate_cents ?? 0;
    const discountCents = Math.round(subtotalCents * (discountPct / 100));
    const totalCents = Math.max(0, subtotalCents - discountCents);
    const trialing = subs.filter((s) => s.status === "trialing" && s.trial_end);
    const soonestTrialEnd = trialing.map((s) => s.trial_end).filter(Boolean).sort()[0];
    const trialDaysLeft = soonestTrialEnd
      ? Math.ceil((new Date(soonestTrialEnd).getTime() - Date.now()) / 86_400_000)
      : null;
    return { data, status, nextEnd, totalCents, discountCents, trialDaysLeft };
  }, [overviewQ.data, bundleRulesQ.data]);

  if (!currentTenantId) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  }
  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!perm?.can_view) {
    return (
      <div className="border rounded-lg p-6 text-sm text-muted-foreground">
        {t("billing.no_access", "You don't have permission to view billing for this organization.")}
      </div>
    );
  }

  const orgName = summary.data?.tenant?.name ?? currentMembership?.tenant_name ?? "";
  const { status, nextEnd, totalCents, discountCents, trialDaysLeft } = summary;
  const pm = summary.data?.default_payment_method;

  return (
    <div className="space-y-5">
      {/* Unified header: org info on the left, monthly total on the right */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {t("billing.org_billing", "Organization Billing")}
          </div>
          <h2 className="text-xl font-semibold mt-1">
            {t("billing.title_for", "Billing for")} {orgName}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("billing.status", "Status")}:</span>
            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${STATUS_TONE[status]}`}>
              {t(`billing.status_${status}`, status.replace("_", " "))}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            {t("billing.estimated_monthly_total", "Estimated Monthly Total")}
          </div>
          <div className="text-2xl font-semibold">{fmtMoney(totalCents)}</div>
          {discountCents > 0 && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              −{fmtMoney(discountCents)} {t("billing.discount_applied", "discount applied")}
            </div>
          )}
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="border rounded-lg bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {t("billing.next_payment_date", "Next Payment Date")}
          </div>
          <div className="mt-1 font-medium">{fmtDate(nextEnd)}</div>
        </div>
        <div className="border rounded-lg bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            {t("billing.payment_method", "Payment Method")}
          </div>
          <div className="mt-1 font-medium">
            {pm ? (
              <span className="capitalize">
                {pm.brand} •••• {pm.last4}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("billing.not_connected_yet", "Not connected yet")}</span>
            )}
          </div>
        </div>
        <div className="border rounded-lg bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {t("billing.trial_status", "Trial Status")}
          </div>
          <div className="mt-1 font-medium">
            {trialDaysLeft === null
              ? t("billing.no_trial", "No active trial")
              : trialDaysLeft > 0
                ? t("billing.trial_days_left", "{{days}} days left", { days: trialDaysLeft })
                : t("billing.trial_ended", "Trial ended")}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {t(
            "billing.mock_banner",
            "Stripe is not connected yet — plan changes and payment methods on this page are simulated for preview.",
          )}
        </span>
      </div>

      <nav className="flex flex-wrap gap-1 border-b">
        {TABS.map((tab) => {
          const active = tab.exact ? path === tab.to : path.startsWith(tab.to);
          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={`px-3 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
                active
                  ? "font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              style={
                active
                  ? { backgroundColor: tab.activeBg, color: tab.activeFg, borderBottomColor: tab.activeFg }
                  : undefined
              }
            >
              {t(`billing.tab.${tab.key}`)}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
