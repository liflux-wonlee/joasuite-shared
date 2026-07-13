import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useJoaSuite } from "../../context";
import { APP_DISPLAY } from "../../constants";

type Metric = {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
  format?: (n: number) => string;
};

function pct(used: number, limit: number | null) {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function barColor(p: number, unlimited: boolean) {
  if (unlimited) return "bg-emerald-500";
  if (p >= 90) return "bg-destructive";
  if (p >= 75) return "bg-amber-500";
  return "bg-primary";
}

const NEXT_PLAN: Record<string, string> = { free: "Basic", basic: "Pro", pro: "Business", business: "Business" };

export function BillingUsagePage() {
  const { t } = useTranslation();
  const { currentApp, useAuth, router, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Link } = router;
  const appName = APP_DISPLAY.find((a) => a.code === currentApp)?.name ?? currentApp;

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing-usage", currentTenantId, currentApp],
    enabled: !!currentTenantId,
    queryFn: () => fns.getTenantUsage({ tenant_id: currentTenantId!, app_code: currentApp }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
        {(error as Error)?.message ?? t("billing.usage.load_failed", "Failed to load usage")}
      </div>
    );
  }

  const { plan_code, limits, usage } = data;
  const planLabel = plan_code.charAt(0).toUpperCase() + plan_code.slice(1);
  const upgradeTo = NEXT_PLAN[plan_code] ?? "Business";

  const metrics: Metric[] = [
    { key: "users", label: t("billing.usage.users", "Users (seats)"), used: usage.users, limit: limits.users },
    { key: "customers", label: t("billing.usage.customers", "Customers"), used: usage.customers, limit: limits.customers },
    { key: "invoices", label: t("billing.usage.invoices_month", "Invoices this month"), used: usage.invoices_this_month, limit: limits.invoices_per_month },
    {
      key: "storage",
      label: t("billing.usage.storage", "Document storage"),
      used: usage.storage_gb,
      limit: limits.storage_gb,
      unit: "GB",
      format: (n) => n.toFixed(2),
    },
    { key: "projects", label: t("billing.usage.projects", "Projects"), used: usage.projects, limit: limits.projects },
    { key: "attachments", label: t("billing.usage.attachments", "Attachments"), used: usage.attachments, limit: limits.attachments },
    { key: "active_apps", label: t("billing.usage.active_apps", "Active JoaSuite apps"), used: usage.active_apps, limit: null },
  ];

  const nearLimit = metrics.filter((m) => m.limit != null && pct(m.used, m.limit) >= 90);

  return (
    <div className="space-y-5">
      <div className="border rounded-lg bg-card px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {t("billing.usage.current_plan", "Current plan")}
          </div>
          <div className="font-semibold text-lg">{appName} · {planLabel}</div>
        </div>
        <Link
          to="/app/account/billing"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("billing.usage.change_plan", "Change plan")}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {nearLimit.length > 0 && plan_code !== "business" && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            {nearLimit.map((m) => (
              <div key={m.key}>
                {t("billing.usage.near_limit_msg", "You are using {{used}} of {{limit}} {{label}}. Upgrade to {{plan}} for more.", {
                  used: m.format ? m.format(m.used) : m.used,
                  limit: m.limit,
                  label: m.label.toLowerCase(),
                  plan: upgradeTo,
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{t("billing.usage.title", "Usage & limits")}</h3>
        </div>
        <div className="divide-y">
          {metrics.map((m) => {
            const unlimited = m.limit == null;
            const p = pct(m.used, m.limit);
            const usedStr = m.format ? m.format(m.used) : String(m.used);
            const limitStr = unlimited
              ? t("billing.usage.unlimited", "Unlimited")
              : `${m.limit}${m.unit ? " " + m.unit : ""}`;
            return (
              <div key={m.key} className="px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {usedStr}
                    {m.unit ? " " + m.unit : ""} / {limitStr}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                  <div
                    className={`h-full ${barColor(p, unlimited)} transition-all`}
                    style={{ width: unlimited ? "100%" : `${p}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "billing.usage.note",
          "Limits are based on your current plan. Live metering is read from your JoaSuite database; some counters use safe fallbacks until full instrumentation lands.",
        )}
      </p>
    </div>
  );
}
