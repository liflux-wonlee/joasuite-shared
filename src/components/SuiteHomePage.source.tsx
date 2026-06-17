import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  Inbox,
  Send,
  Bell,
  ScrollText,
  Settings2,
  Building2,
  Users,
  Shield,
  AppWindow,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listSuiteApps,
  subscribeApp,
  cancelApp,
  type AppCatalogEntry,
  type TenantAppRow,
} from "@/lib/suite.functions";
import { getSuiteHome, setAppUrl } from "@/lib/suite-home.functions";

export const Route = createFileRoute("/app/suite")({ component: SuiteHomePage });

// Sane defaults — overridable per-tenant in settings_kv (app_url.*)
const DEFAULT_APP_URLS: Record<string, string> = {
  joabooks: "https://books.joasuite.com",
  joaapproval: "https://approval.joasuite.com",
  joacrm: "https://crm.joasuite.com",
  joaoffice: "https://office.joasuite.com",
  joasop: "https://sop.joasuite.com",
};

// NOTE: app_code `joabooks` is the canonical DB identifier; user-facing name is "JoaBooks".
const APP_META: Array<{ code: string; name: string; description: string }> = [
  { code: "joabooks", name: "JoaBooks", description: "Finance — AP, AR, expenses, ledger" },
  { code: "joaapproval", name: "JoaApproval", description: "Cross-app approval inbox" },
  { code: "joacrm", name: "JoaCRM", description: "Customer relationships" },
  { code: "joaoffice", name: "JoaOffice", description: "Admin, assets, contracts" },
  { code: "joasop", name: "JoaSOP", description: "Policies, SOPs, training" },
];

function formatMoney(n: number | null | undefined) {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

function SuiteHomePage() {
  const { t } = useTranslation();
  const { currentMembership } = useAuth();
  const tenantId = currentMembership?.tenant_id ?? "";
  const isAdmin = (currentMembership?.roles ?? []).some((r) =>
    ["owner", "super_admin"].includes(r),
  );
  const qc = useQueryClient();

  const fetchApps = useServerFn(listSuiteApps);
  const fetchHome = useServerFn(getSuiteHome);
  const subFn = useServerFn(subscribeApp);
  const cancelFn = useServerFn(cancelApp);
  const setUrlFn = useServerFn(setAppUrl);

  const appsQ = useQuery({
    queryKey: ["suite-apps", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchApps({ data: { tenantId } }),
  });
  const homeQ = useQuery({
    queryKey: ["suite-home", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchHome({ data: { tenantId } }),
  });

  const subsByCode = useMemo(() => {
    const m = new Map<string, TenantAppRow>();
    (appsQ.data?.subscriptions ?? []).forEach((s) => m.set(s.app_code, s));
    return m;
  }, [appsQ.data]);
  const catalogByCode = useMemo(() => {
    const m = new Map<string, AppCatalogEntry>();
    (appsQ.data?.catalog ?? []).forEach((c) => m.set(c.code, c));
    return m;
  }, [appsQ.data]);

  const appUrls = homeQ.data?.appUrls ?? {};
  const resolveUrl = (code: string) => appUrls[code] || DEFAULT_APP_URLS[code] || "";

  const subMut = useMutation({
    mutationFn: (v: { appCode: string; plan: string }) =>
      subFn({ data: { tenantId, ...v } }),
    onSuccess: () => {
      toast.success(t("suite.activated", "App activated"));
      qc.invalidateQueries({ queryKey: ["suite-apps", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const cancelMut = useMutation({
    mutationFn: (appCode: string) => cancelFn({ data: { tenantId, appCode } }),
    onSuccess: () => {
      toast.success(t("suite.canceled", "Subscription canceled. Data is preserved."));
      qc.invalidateQueries({ queryKey: ["suite-apps", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const urlMut = useMutation({
    mutationFn: (v: { appCode: any; url: string }) =>
      setUrlFn({ data: { tenantId, ...v } }),
    onSuccess: () => {
      toast.success(t("suite.url_saved", "URL saved"));
      qc.invalidateQueries({ queryKey: ["suite-home", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!tenantId) return null;

  const cardFor = (code: string) => {
    const meta = APP_META.find((a) => a.code === code)!;
    const catalog = catalogByCode.get(code);
    const sub = subsByCode.get(code);
    const url = resolveUrl(code);
    const isActiveSub = sub?.status === "active";
    const isJoaBooks = code === "joabooks";
    // JoaBooks (DB code `joabooks`) is treated as the host app: always available in-product.
    // catalog row is absent when app_catalog.is_active = false (filtered server-side) → coming_soon
    let state:
      | "active_open"
      | "active_no_url"
      | "coming_soon"
      | "not_subscribed";
    if (isJoaBooks) state = "active_open";
    else if (isActiveSub && url) state = "active_open";
    else if (isActiveSub && !url) state = "active_no_url";
    else if (!catalog) state = "coming_soon";
    else state = "not_subscribed";

    return { meta, catalog, sub, url, state };
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("suite.home_title", "JoaSuite")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "suite.home_subtitle",
              "Your business operations suite. One workspace, multiple apps.",
            )}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{currentMembership?.tenant_name}</span>
        </div>
      </div>

      {/* A. App Launcher */}
      <section className="space-y-3">
        <SectionHeader
          icon={AppWindow}
          title={t("suite.section.launcher", "App Launcher")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {APP_META.map((m) => {
            const info = cardFor(m.code);
            return (
              <AppCard
                key={m.code}
                code={m.code}
                name={m.name}
                description={m.description}
                state={info.state}
                url={info.url}
                isAdmin={isAdmin}
                hasUserAccess={(appsQ.data?.myAppCodes ?? []).includes(m.code)}
                onSubscribe={() =>
                  subMut.mutate({
                    appCode: m.code,
                    plan: info.catalog?.plans?.[0]?.code ?? "free",
                  })
                }
                subscribePending={subMut.isPending}
              />
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* B. My Approvals */}
        <Card className="p-5">
          <SectionHeader icon={Inbox} title={t("suite.section.my_approvals", "My Approvals")} />
          <div className="mt-3 space-y-2">
            {homeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : (homeQ.data?.myApprovals ?? []).length === 0 ? (
              <EmptyState text={t("suite.empty.approvals", "No pending approvals.")} />
            ) : (
              homeQ.data!.myApprovals.map((a) => (
                <Link
                  key={a.id}
                  to={"/app/approvals/$id" as any}
                  params={{ id: a.doc_id } as any}
                  className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {a.title ?? a.doc_kind}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.source_app} · {a.doc_kind}
                      {a.due_date ? ` · due ${a.due_date}` : ""}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums text-muted-foreground">
                    {formatMoney(a.amount_usd)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* C. Requested by Me */}
        <Card className="p-5">
          <SectionHeader icon={Send} title={t("suite.section.requested", "Requested by Me")} />
          <div className="mt-3 space-y-2">
            {homeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : (homeQ.data?.requestedByMe ?? []).length === 0 ? (
              <EmptyState text={t("suite.empty.requested", "Nothing requested yet.")} />
            ) : (
              homeQ.data!.requestedByMe.map((r) => {
                const to =
                  r.kind === "payment_request"
                    ? "/app/payment-requests/$id"
                    : "/app/bills/$id";
                return (
                  <Link
                    key={`${r.kind}-${r.id}`}
                    to={to as any}
                    params={{ id: r.id } as any}
                    className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.no ?? r.kind}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.kind} · {r.status}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {formatMoney(r.amount_usd)}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* D. Notifications */}
        <Card className="p-5">
          <SectionHeader icon={Bell} title={t("suite.section.notifications", "Notifications")}>
            <Link
              to="/app/notifications"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t("common.view_all", "View all")} <ArrowRight className="h-3 w-3" />
            </Link>
          </SectionHeader>
          <div className="mt-3 space-y-2">
            {homeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : (homeQ.data?.notifications ?? []).length === 0 ? (
              <EmptyState text={t("suite.empty.notifications", "No notifications.")} />
            ) : (
              homeQ.data!.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-2 rounded text-sm ${n.read_at ? "" : "bg-muted/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{n.title}</span>
                    {n.app_code && (
                      <Badge variant="outline" className="text-[10px]">
                        {n.app_code}
                      </Badge>
                    )}
                  </div>
                  {n.body && (
                    <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* E. Recent Activity */}
        <Card className="p-5">
          <SectionHeader
            icon={ScrollText}
            title={t("suite.section.activity", "Recent Activity")}
          >
            <Link
              to="/app/audit-logs"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {t("common.view_all", "View all")} <ArrowRight className="h-3 w-3" />
            </Link>
          </SectionHeader>
          <div className="mt-3 space-y-1.5">
            {homeQ.isLoading ? (
              <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
            ) : (homeQ.data?.recentActivity ?? []).length === 0 ? (
              <EmptyState text={t("suite.empty.activity", "No recent activity.")} />
            ) : (
              homeQ.data!.recentActivity.map((a) => (
                <div key={a.id} className="text-xs flex items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                  <span className="font-medium">{a.user_name ?? "system"}</span>
                  <span className="text-muted-foreground">
                    {a.action} {a.record_type}
                  </span>
                  {a.app_code && (
                    <Badge variant="outline" className="text-[10px]">
                      {a.app_code}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* F. Organization Setup */}
      <section className="space-y-3">
        <SectionHeader
          icon={Building2}
          title={t("suite.section.org", "Organization Setup")}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SetupTile
            to="/app/suite/settings"
            icon={Settings2}
            label={t("suite.settings.title", "Suite Settings")}
          />
          <SetupTile
            to="/app/settings/general"
            icon={Building2}
            label={t("suite.tile.company", "Company Profile")}
          />
          {isAdmin && (
            <SetupTile
              to="/app/people"
              icon={Users}
              label={t("suite.tile.people", "People")}
            />
          )}
          <SetupTile
            to="/app/settings/organizations"
            icon={Shield}
            label={t("suite.tile.org_units", "Departments")}
          />
          <DisabledTile
            icon={Users}
            label={t("suite.tile.positions", "Positions")}
            note={t("suite.state.coming_soon", "Coming Soon")}
          />
          <DisabledTile
            icon={Users}
            label={t("suite.tile.directory", "Directory")}
            note={t(
              "suite.tile.directory_desc",
              "Directory will provide shared access to customers, vendors, employees, contractors, and contacts across JoaSuite apps.",
            )}
          />
          <SetupTile
            to="/app/audit-logs"
            icon={ScrollText}
            label={t("suite.tile.audit_logs", "Audit Logs")}
          />
          <SetupTile
            to="/app/settings"
            icon={Settings2}
            label={t("suite.tile.settings", "All Settings")}
          />
        </div>
      </section>

      {/* G. Add Apps + External URL config */}
      <section className="space-y-3">
        <SectionHeader
          icon={ExternalLink}
          title={t("suite.section.add_apps", "Add Apps & External URLs")}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {APP_META.filter((m) => m.code !== "joabooks").map((m) => {
            const info = cardFor(m.code);
            return (
              <Card key={m.code} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{m.name}</span>
                    <StateBadge state={info.state} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {info.url || t("suite.no_url", "No external URL configured")}
                  </div>
                </div>
                {isAdmin && (
                  <>
                    <ConfigureUrlDialog
                      appCode={m.code}
                      currentUrl={info.url}
                      onSave={(url) => urlMut.mutate({ appCode: m.code, url })}
                    />
                    {info.sub?.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(t("suite.confirm_cancel", "Cancel this subscription?")))
                            cancelMut.mutate(m.code);
                        }}
                      >
                        {t("suite.cancel", "Cancel")}
                      </Button>
                    ) : info.catalog && (info.catalog as any).is_active !== false ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          subMut.mutate({
                            appCode: m.code,
                            plan: info.catalog?.plans?.[0]?.code ?? "free",
                          })
                        }
                        disabled={subMut.isPending}
                      >
                        {t("suite.subscribe", "Subscribe")}
                      </Button>
                    ) : null}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-sm text-muted-foreground py-4 text-center">{text}</div>;
}

function DisabledTile({ icon: Icon, label, note }: { icon: any; label: string; note: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card/50 flex flex-col items-start gap-2 opacity-70">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[11px] text-muted-foreground line-clamp-2">{note}</span>
    </div>
  );
}

function SetupTile({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to as any}
      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors flex flex-col items-start gap-2"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function StateBadge({ state }: { state: string }) {
  const { t } = useTranslation();
  if (state === "active_open")
    return (
      <Badge variant="default" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> {t("suite.state.active", "Active")}
      </Badge>
    );
  if (state === "active_no_url")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        {t("suite.state.no_url", "Enabled, URL not configured")}
      </Badge>
    );
  if (state === "coming_soon")
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <Clock className="h-3 w-3" /> {t("suite.state.coming_soon", "Coming Soon")}
      </Badge>
    );
  if (state === "not_subscribed")
    return (
      <Badge variant="outline" className="text-[10px]">
        {t("suite.state.not_subscribed", "Not subscribed")}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px]">
      {t("suite.state.not_configured", "Not configured")}
    </Badge>
  );
}

function AppCard({
  code,
  name,
  description,
  state,
  url,
  isAdmin,
  hasUserAccess,
  onSubscribe,
  subscribePending,
}: {
  code: string;
  name: string;
  description: string;
  state: string;
  url: string;
  isAdmin: boolean;
  hasUserAccess: boolean;
  onSubscribe: () => void;
  subscribePending: boolean;
}) {
  const { t } = useTranslation();
  const isJoaBooks = code === "joabooks";

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
        <StateBadge state={state} />
      </div>

      <div className="flex-1" />

      <div className="flex flex-wrap gap-2">
        {isJoaBooks ? (
          <Link to="/app">
            <Button size="sm">
              {t("suite.open_app", "Open App")} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </Link>
        ) : state === "active_open" ? (
          <Button
            size="sm"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            disabled={!hasUserAccess}
            title={
              hasUserAccess
                ? undefined
                : t("suite.no_user_access", "You don't have access to this app")
            }
          >
            {t("suite.open_app", "Open App")}
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        ) : state === "active_no_url" ? (
          <span className="text-xs text-muted-foreground self-center">
            {t("suite.state.no_url", "Enabled, URL not configured")}
          </span>
        ) : state === "not_subscribed" ? (
          isAdmin ? (
            <Button size="sm" variant="outline" onClick={onSubscribe} disabled={subscribePending}>
              {t("suite.subscribe", "Subscribe")}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground self-center">
              {t("suite.admin_only", "Admin can subscribe")}
            </span>
          )
        ) : (
          <span className="text-xs text-muted-foreground self-center">
            {state === "coming_soon"
              ? t("suite.state.coming_soon", "Coming Soon")
              : t("suite.state.not_configured", "Not configured")}
          </span>
        )}
      </div>
    </Card>
  );
}

function ConfigureUrlDialog({
  appCode,
  currentUrl,
  onSave,
}: {
  appCode: string;
  currentUrl: string;
  onSave: (url: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(currentUrl);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setVal(currentUrl);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("suite.set_url", "Set URL")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("suite.set_external_url", "External URL")} — {appCode}
          </DialogTitle>
        </DialogHeader>
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://example.lovable.app"
        />
        <p className="text-xs text-muted-foreground">
          {t(
            "suite.set_url_help",
            "Leave blank to unset. Saved per-workspace in settings_kv (app_url.*).",
          )}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(val.trim());
              setOpen(false);
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
