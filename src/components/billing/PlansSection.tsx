import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import {
  Check,
  Sparkles,
  Clock,
  Ban,
  Plus,
  Trash2,
  Zap,
  RefreshCw,
  XCircle,
  GitCompare,
} from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";
import { APP_DISPLAY } from "../../constants";

const APPS = APP_DISPLAY.map((a) => ({
  code: a.code,
  name: a.name,
  description: a.description,
  removable: a.code !== "joabooks",
}));

const PLAN_BADGE_STYLE: Record<string, React.CSSProperties> = {
  basic: { backgroundColor: "#DEE545", color: "#1a1a1a" },
  pro: { backgroundColor: "#E56F3F", color: "#ffffff" },
  business: { backgroundColor: "#454545", color: "#ffffff" },
  enterprise: { backgroundColor: "#454545", color: "#ffffff" },
};

function planBadgeStyle(plan?: string | null): React.CSSProperties | undefined {
  if (!plan) return undefined;
  return PLAN_BADGE_STYLE[plan.toLowerCase()];
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PlansSection() {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Link, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } = ui as any;
  const qc = useQueryClient();
  const [changeFor, setChangeFor] = useState<string | null>(null);

  const plansQ = useQuery({ queryKey: ["billing-plans", "all"], queryFn: () => fns.listBillingPlans() });
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

  type SubRow = {
    app_code: string;
    plan_code?: string | null;
    interval?: "month" | "year" | null;
    status?: string | null;
    synthetic?: boolean | null;
    cancel_at_period_end?: boolean | null;
    trial_end?: string | null;
    [key: string]: unknown;
  };
  type PlanRow = {
    app_code: string;
    plan_code: string;
    interval: "month" | "year";
    [key: string]: unknown;
  };

  const subByApp = useMemo(() => {
    const m = new Map<string, SubRow>();
    ((overviewQ.data?.subscriptions ?? []) as SubRow[]).forEach((s) => m.set(s.app_code, s));
    return m;
  }, [overviewQ.data]);

  const plansByApp = useMemo(() => {
    const m = new Map<string, PlanRow[]>();
    ((plansQ.data ?? []) as PlanRow[]).forEach((p) => {
      const arr = m.get(p.app_code) ?? [];
      arr.push(p);
      m.set(p.app_code, arr);
    });
    return m;
  }, [plansQ.data]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["billing-overview"] });
  }

  const wrap = <T,>(fn: (input: T) => Promise<unknown>, successMsg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(successMsg);
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const mChange = wrap(
    (input: { app_code: string; plan_code: string; interval: "month" | "year" }) =>
      fns.changeSubscriptionPlan({ tenant_id: currentTenantId!, app_code: input.app_code, plan_code: input.plan_code, interval: input.interval, seats: 1 }),
    t("billing.plan_change_success", "Plan updated (simulated)"),
  );
  const mCancel = wrap(
    (input: { app_code: string }) =>
      fns.cancelSubscription({ tenant_id: currentTenantId!, app_code: input.app_code, at_period_end: true }),
    t("billing.cancel_success", "Will cancel at period end (simulated)"),
  );
  const mReactivate = wrap(
    (input: { app_code: string }) =>
      fns.reactivateSubscription({ tenant_id: currentTenantId!, app_code: input.app_code }),
    t("billing.reactivate_success", "Subscription reactivated (simulated)"),
  );
  const mTrial = wrap(
    (input: { app_code: string }) =>
      fns.startTrial({ tenant_id: currentTenantId!, app_code: input.app_code, plan_code: "pro", interval: "month", trial_days: 14 }),
    t("billing.trial_started", "14-day trial started (simulated)"),
  );
  const mAdd = wrap(
    (input: { app_code: string }) =>
      fns.addAppSubscription({ tenant_id: currentTenantId!, app_code: input.app_code, plan_code: "basic", interval: "month" }),
    t("billing.app_added", "App added (simulated)"),
  );
  const mRemove = wrap(
    (input: { app_code: string }) =>
      fns.removeAppSubscription({ tenant_id: currentTenantId!, app_code: input.app_code }),
    t("billing.app_removed", "App removed (simulated)"),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200 px-3 py-2 text-xs flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("billing.stripe_future", "Stripe payment will be connected in a future phase. All actions on this page update local data only.")}</span>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("billing.app", "App")}</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("billing.current_plan", "Plan")}</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t("billing.monthly", "Monthly")}</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t("billing.yearly", "Yearly")}</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t("billing.status", "Status")}</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t("billing.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {APPS.map((app) => {
              const sub = subByApp.get(app.code);
              const plans = (plansByApp.get(app.code) ?? []) as any[];
              const status: string = sub?.status ?? "inactive";
              const currentPlan = sub?.plan_code ?? "—";
              const currentInterval = sub?.interval ?? "month";
              const monthly = plans.find((p) => p.plan_code === currentPlan && p.interval === "month");
              const yearly = plans.find((p) => p.plan_code === currentPlan && p.interval === "year");
              const isTrialing = status === "trialing";
              const isCanceled = status === "canceled" || sub?.cancel_at_period_end;
              const hasSub = !!sub;

              return (
                <tr key={app.code} className="hover:bg-muted/30">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-muted-foreground">{app.description}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-medium capitalize">{currentPlan} <span className="text-muted-foreground font-normal">/ {currentInterval}</span></span>
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums">
                    {monthly ? fmtMoney(monthly.price_cents) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums">
                    {yearly ? fmtMoney(yearly.price_cents) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {!hasSub ? (
                      <span className="inline-flex text-[10px] uppercase font-semibold px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                        {t("billing.not_subscribed", "Not subscribed")}
                      </span>
                    ) : (
                      <span
                        className="inline-flex text-[10px] uppercase font-semibold px-2 py-0.5 rounded"
                        style={planBadgeStyle(currentPlan) ?? { backgroundColor: "#454545", color: "#fff" }}
                      >
                        {currentPlan}
                        {isTrialing ? ` · ${t("billing.trial", "Trial")}` : ""}
                        {isCanceled ? ` · ${t("billing.canceling", "Canceling")}` : ""}
                      </span>
                    )}
                    {isTrialing && sub?.trial_end && (
                      <div className="text-xs text-blue-700 dark:text-blue-300 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtDate(sub.trial_end)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {!hasSub ? (
                        <>
                          <Button size="sm" disabled={!canManage || mAdd.isPending} onClick={() => mAdd.mutate({ app_code: app.code })} className="gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            {t("billing.add_app", "Add")}
                          </Button>
                          <Button size="sm" variant="outline" disabled={!canManage || mTrial.isPending} onClick={() => mTrial.mutate({ app_code: app.code })} className="gap-1.5">
                            <Zap className="h-3.5 w-3.5" />
                            {t("billing.start_trial", "Trial")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setChangeFor(app.code)}>
                            {t("billing.change_plan", "Change")}
                          </Button>
                          {isCanceled ? (
                            <Button size="sm" disabled={!canManage || mReactivate.isPending} onClick={() => mReactivate.mutate({ app_code: app.code })} className="gap-1.5">
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t("billing.reactivate", "Reactivate")}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={!canManage || mCancel.isPending} onClick={() => mCancel.mutate({ app_code: app.code })} className="gap-1.5">
                              <XCircle className="h-3.5 w-3.5" />
                              {t("billing.cancel_at_period_end", "Cancel")}
                            </Button>
                          )}
                          {app.removable && (
                            <Button size="sm" variant="ghost" disabled={!canManage || mRemove.isPending} onClick={() => mRemove.mutate({ app_code: app.code })} className="gap-1.5 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                              {t("billing.remove_app", "Remove")}
                            </Button>
                          )}
                        </>
                      )}
                      <Link
                        to="/app/account/billing/compare"
                        search={{ app: app.code }}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border hover:bg-accent"
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                        {t("billing.compare_plans", "Compare")}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!changeFor} onOpenChange={(o: boolean) => !o && setChangeFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("billing.change_plan_for", "Change plan for")} {changeFor}</DialogTitle>
            <DialogDescription>
              {t("billing.stripe_future_short", "Updates local data only — Stripe coming later.")}
            </DialogDescription>
          </DialogHeader>
          {changeFor && (
            <ChangePlanGrid
              plans={plansByApp.get(changeFor) ?? []}
              currentPlan={subByApp.get(changeFor)?.plan_code ?? undefined}
              currentInterval={subByApp.get(changeFor)?.interval ?? "month"}
              disabled={!canManage || mChange.isPending}
              onPick={(plan_code, interval) => {
                mChange.mutate(
                  { app_code: changeFor, plan_code, interval },
                  { onSettled: () => setChangeFor(null) },
                );
              }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeFor(null)}>{t("common.cancel", "Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangePlanGrid({
  plans,
  currentPlan,
  currentInterval,
  disabled,
  onPick,
}: {
  plans: any[];
  currentPlan?: string;
  currentInterval: "month" | "year";
  disabled: boolean;
  onPick: (plan_code: string, interval: "month" | "year") => void;
}) {
  const { t } = useTranslation();
  const [interval, setInterval] = useState<"month" | "year">(currentInterval);
  const filtered = plans.filter((p) => p.interval === interval);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((p) => {
          const isCurrent = currentPlan === p.plan_code && currentInterval === p.interval;
          const features: string[] = Array.isArray(p.features) ? p.features : [];
          return (
            <button
              key={p.plan_code}
              disabled={disabled || isCurrent}
              onClick={() => onPick(p.plan_code, p.interval)}
              className={`text-left border rounded-lg p-3 hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed ${isCurrent ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm font-semibold">{fmtMoney(p.price_cents)}</div>
              </div>
              {p.description && <div className="text-xs text-muted-foreground mt-1">{p.description}</div>}
              {features.length > 0 && (
                <ul className="text-xs space-y-0.5 mt-2">
                  {features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isCurrent && (
                <div className="text-[10px] uppercase font-semibold text-primary mt-2">
                  {t("billing.current_plan", "Current plan")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
