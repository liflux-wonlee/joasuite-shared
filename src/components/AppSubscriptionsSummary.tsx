import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, ExternalLink, BookOpen, ClipboardCheck, Users, Briefcase, FileText, UserCog } from "lucide-react";
import { useJoaSuite } from "../context";
import { APP_DISPLAY, DEFAULT_APP_URLS, type AppCode } from "../constants";
import type { AppCatalogEntry, TenantAppRow } from "../server/suite.functions";

/**
 * Read-only summary of the tenant's app subscriptions, shown in Suite Settings.
 * All plan/billing changes are delegated to `/app/account/billing`.
 * The only affordance on this panel is "Open App" for subscribed apps.
 */

const APP_ICONS: Record<AppCode, React.ComponentType<{ className?: string }>> = {
  joabooks: BookOpen,
  joaapproval: ClipboardCheck,
  joacrm: Users,
  joaoffice: Briefcase,
  joasop: FileText,
  joahr: UserCog,
};

function planBadgeStyle(plan: string | null | undefined): React.CSSProperties | undefined {
  const p = (plan ?? "").toLowerCase();
  if (p === "basic") return { backgroundColor: "#DEE545", color: "#1a1a1a" };
  if (p === "pro") return { backgroundColor: "#E56F3F", color: "#ffffff" };
  if (p === "business" || p === "enterprise")
    return { backgroundColor: "#454545", color: "#ffffff" };
  return undefined;
}

function planLabel(plan: string | null | undefined): string {
  const p = (plan ?? "").toLowerCase();
  if (!p) return "";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function AppSubscriptionsSummary() {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns, currentApp } = useJoaSuite();
  const { Link } = router;
  const { Card } = ui;
  const { currentMembership } = useAuth();
  const tenantId = currentMembership?.tenant_id ?? "";

  const appsQ = useQuery({
    queryKey: ["suite-apps", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.listSuiteApps({ tenantId }),
  });
  const homeQ = useQuery({
    queryKey: ["suite-home", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.getSuiteHome({ tenantId }),
  });

  const subsByCode = useMemo(() => {
    const m = new Map<string, TenantAppRow>();
    (appsQ.data?.subscriptions ?? []).forEach((s: TenantAppRow) => m.set(s.app_code, s));
    return m;
  }, [appsQ.data]);
  const catalogByCode = useMemo(() => {
    const m = new Map<string, AppCatalogEntry>();
    (appsQ.data?.catalog ?? []).forEach((c: AppCatalogEntry) => m.set(c.code, c));
    return m;
  }, [appsQ.data]);

  const appUrls = homeQ.data?.appUrls ?? {};
  const resolveUrl = (code: string) => appUrls[code] || DEFAULT_APP_URLS[code as AppCode] || "";

  if (!tenantId) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
        <div className="text-sm text-muted-foreground">
          {t(
            "suite.subscriptions.summary_hint",
            "Read-only summary. To change plans, start a trial, or cancel, go to Billing.",
          )}
        </div>
        <Link
          to="/app/account/billing"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline whitespace-nowrap"
        >
          {t("suite.subscriptions.manage_cta", "Manage plans & billing")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="divide-y">
        {APP_DISPLAY.map((meta) => {
          const sub = subsByCode.get(meta.code);
          const catalog = catalogByCode.get(meta.code);
          const isHostApp = meta.code === currentApp;
          const isActive = isHostApp || sub?.status === "active";
          const isCanceled = sub?.status === "canceled";
          const plan = sub?.plan ?? (isHostApp ? "basic" : null);
          const url = resolveUrl(meta.code);
          const Icon = APP_ICONS[meta.code];
          const badge = planBadgeStyle(plan);

          const statusLabel = isActive
            ? t("suite.subscriptions.status.active", "Active")
            : isCanceled
              ? t("suite.subscriptions.status.canceled", "Canceled")
              : !catalog
                ? t("suite.state.coming_soon", "Coming Soon")
                : t("suite.subscriptions.status.not_subscribed", "Not subscribed");

          return (
            <li key={meta.code} className="flex items-center gap-4 px-4 py-3">
              <div className="rounded-md bg-muted p-2 shrink-0">
                <Icon className="h-5 w-5 text-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{meta.name}</span>
                  {isActive && badge && (
                    <span
                      className="text-[10px] leading-none px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide"
                      style={badge}
                    >
                      {planLabel(plan)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {meta.description}
                </div>
              </div>

              <div className="text-xs text-muted-foreground whitespace-nowrap min-w-[6rem] text-right">
                {statusLabel}
              </div>

              <div className="w-24 flex justify-end">
                {isActive && (isHostApp ? (
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t("suite.subscriptions.open_app", "Open")}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t("suite.subscriptions.open_app", "Open")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {t("suite.state.no_url", "No URL")}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
