import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Inbox, Send, Bell, ScrollText, Settings2, Home, ArrowRight } from "lucide-react";
import { useJoaSuite } from "../context";

function formatMoney(n: number | null | undefined) {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));
}

export function SuiteHomePage() {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns } = useJoaSuite();
  const { Link } = router;
  const { Card, Badge } = ui;
  const { currentMembership } = useAuth();
  const tenantId = currentMembership?.tenant_id ?? "";

  const homeQ = useQuery({
    queryKey: ["suite-home", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.getSuiteHome({ tenantId }),
  });

  if (!tenantId) return null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header — clearly distinct from Settings */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2.5 mt-0.5">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("suite.home_title", "JoaSuite Home")}
            </h1>
            {currentMembership?.tenant_name && (
              <div className="text-base font-medium text-foreground mt-1">
                {currentMembership.tenant_name}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "suite.home_subtitle",
                "Your daily workspace — approvals, requests, notifications, and activity across every JoaSuite app.",
              )}
            </p>
          </div>
        </div>
      </div>

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
              homeQ.data!.myApprovals.map((a: any) => (
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
              homeQ.data!.requestedByMe.map((r: any) => {
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
              homeQ.data!.notifications.map((n: any) => (
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
              homeQ.data!.recentActivity.map((a: any) => (
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

      {/* F. Suite Settings CTA */}
      <section className="space-y-3">
        <Link to="/app/suite/settings" className="block">
          <Card className="p-5 flex items-center gap-4 hover:bg-muted/50 transition-colors">
            <div className="rounded-md bg-primary/10 text-primary p-2.5">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {t("suite.settings.title", "Suite Settings")}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "suite.settings_cta_desc",
                  "Manage organization, people, apps, and platform policies.",
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
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
