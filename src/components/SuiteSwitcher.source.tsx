import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Layers, ExternalLink, Check, Settings2, Home, Users, Bell, ScrollText, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listSuiteApps } from "@/lib/suite.functions";
import { getSuiteHome } from "@/lib/suite-home.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Default external URL per app (overridable per-tenant in settings_kv).
const DEFAULT_APP_URLS: Record<string, string> = {
  joabooks: "https://books.joasuite.com",
  joaapproval: "https://approval.joasuite.com",
  joacrm: "https://crm.joasuite.com",
  joaoffice: "https://office.joasuite.com",
  joasop: "https://sop.joasuite.com",
  sop: "https://sop.joasuite.com", // legacy code
};

// NOTE: app_code `joabooks` is the canonical DB identifier; user-facing name is "JoaBooks".
const APP_DISPLAY: Array<{ code: string; name: string }> = [
  { code: "joabooks", name: "JoaBooks" },
  { code: "joaapproval", name: "JoaApproval" },
  { code: "joacrm", name: "JoaCRM" },
  { code: "joaoffice", name: "JoaOffice" },
  { code: "joasop", name: "JoaSOP" },
];

export function SuiteSwitcher() {
  const { t } = useTranslation();
  const { currentMembership, memberships } = useAuth();
  const tenantId = currentMembership?.tenant_id ?? "";
  const canManagePeople = (memberships ?? []).some((m) =>
    (m.roles ?? []).some((r) => r === "owner" || r === "super_admin"),
  );
  const fetchApps = useServerFn(listSuiteApps);
  const fetchHome = useServerFn(getSuiteHome);

  const q = useQuery({
    queryKey: ["suite-switcher-apps", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchApps({ data: { tenantId } }),
    staleTime: 60_000,
  });

  const homeQ = useQuery({
    queryKey: ["suite-switcher-urls", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchHome({ data: { tenantId } }),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const subs = new Set(
      (q.data?.subscriptions ?? [])
        .filter((s) => s.status === "active")
        .map((s) => s.app_code),
    );
    const mine = new Set(q.data?.myAppCodes ?? []);
    const tenantUrls = homeQ.data?.appUrls ?? {};
    return APP_DISPLAY.map((a) => {
      const active = a.code === "joabooks" || subs.has(a.code);
      // Accessibility is enforced by the target app's own auth.
      // Allow opening any active+subscribed app the tenant has enabled.
      const accessible = a.code === "joabooks" || mine.has(a.code) || subs.has(a.code);
      const url = tenantUrls[a.code] || DEFAULT_APP_URLS[a.code] || "";
      return { ...a, active, accessible, url };
    });
  }, [q.data, homeQ.data]);

  const currentCode = "joabooks";
  const [appsOpen, setAppsOpen] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("suite.switcher_aria", "Open JoaSuite app switcher")}
          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm font-medium hover:bg-muted transition-colors"
        >
          <Layers className="h-5 w-5" />
          <span className="hidden md:inline">JoaSuite</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link to="/app/suite" className="flex items-center gap-2 cursor-pointer">
            <Home className="h-4 w-4 opacity-70" />
            <span>{t("suite.home", "JoaSuite Home")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAppsOpen((v) => !v);
          }}
          className="flex w-full items-center justify-between px-2 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted/50 rounded-sm cursor-pointer"
          aria-expanded={appsOpen}
        >
          <span>{t("suite.switch_app", "Switch App")}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${appsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-200 ${appsOpen ? "max-h-96" : "max-h-0"}`}
        >
          {items.map((item) => {
            const isCurrent = item.code === currentCode;
            const disabled = isCurrent || !item.active || !item.accessible || !item.url;
            return (
              <DropdownMenuItem
                key={item.code}
                disabled={disabled}
                onSelect={(e) => {
                  if (disabled) return;
                  e.preventDefault();
                  window.open(item.url, "_blank", "noopener,noreferrer");
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Layers className="h-4 w-4 shrink-0 opacity-70" />
                <span className="flex-1 truncate">{item.name}</span>
                {isCurrent ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : item.active && item.url ? (
                  <ExternalLink className="h-3.5 w-3.5 opacity-50" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {!item.active ? t("suite.state.not_subscribed", "—") : t("suite.no_url", "no URL")}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("suite.core", "Suite / Core")}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/suite/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings2 className="h-4 w-4 opacity-70" />
            <span>{t("suite.settings.title", "Suite Settings")}</span>
          </Link>
        </DropdownMenuItem>
        {canManagePeople && (
          <DropdownMenuItem asChild>
            <Link to="/app/people" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4 opacity-70" />
              <span>{t("suite.tile.people", "People")}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/app/notifications" className="flex items-center gap-2 cursor-pointer">
            <Bell className="h-4 w-4 opacity-70" />
            <span>{t("suite.tile.notifications", "Notifications")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/audit-logs" className="flex items-center gap-2 cursor-pointer">
            <ScrollText className="h-4 w-4 opacity-70" />
            <span>{t("suite.tile.audit_logs", "Audit Logs")}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/suite" className="flex items-center gap-2 cursor-pointer">
            <Settings2 className="h-4 w-4 opacity-70" />
            <span>{t("suite.manage_apps", "Manage apps")}</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
