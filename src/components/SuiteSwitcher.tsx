import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Check,
  Lock,
  Settings2,
  Home,
  Users,
  Bell,
  ScrollText,
  ChevronDown,
  BookOpen,
  ClipboardCheck,
  Briefcase,
  FileText,
  UserCog,
} from "lucide-react";
import { useJoaSuite } from "../context";
import { APP_DISPLAY, DEFAULT_APP_URLS, type AppCode } from "../constants";

const APP_ICONS: Record<AppCode, React.ComponentType<{ className?: string }>> = {
  joabooks: BookOpen,
  joaapproval: ClipboardCheck,
  joacrm: Users,
  joaoffice: Briefcase,
  joasop: FileText,
  joahr: UserCog,
};

export function SuiteSwitcher() {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns, currentApp } = useJoaSuite();
  const { Link } = router;
  const {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } = ui;
  const { currentMembership, memberships } = useAuth();
  const tenantId = currentMembership?.tenant_id ?? "";
  const canManageUsers = (memberships ?? []).some((m) =>
    (m.roles ?? []).some((r) => r === "owner" || r === "super_admin"),
  );

  const q = useQuery({
    queryKey: ["suite-switcher-apps", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.listSuiteApps({ tenantId }),
    staleTime: 60_000,
  });

  const homeQ = useQuery({
    queryKey: ["suite-switcher-urls", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.getSuiteHome({ tenantId }),
    staleTime: 60_000,
  });

  const subs = useMemo(
    () =>
      new Set(
        (q.data?.subscriptions ?? [])
          .filter((s: any) => s.status === "active")
          .map((s: any) => s.app_code),
      ),
    [q.data],
  );
  const tenantUrls = homeQ.data?.appUrls ?? {};
  const urlFor = (code: string) => tenantUrls[code] || DEFAULT_APP_URLS[code as AppCode] || "";

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
      <DropdownMenuContent align="end" className="w-[340px]">
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
          className={`overflow-hidden transition-all duration-200 ${appsOpen ? "max-h-[400px]" : "max-h-0"}`}
        >
          <div className="grid grid-cols-3 gap-2 p-2">
            {APP_DISPLAY.map((a) => {
              const isCurrent = a.code === currentApp;
              const subscribed = isCurrent || subs.has(a.code);
              const url = urlFor(a.code);
              const Icon = APP_ICONS[a.code];

              const baseCls =
                "relative flex flex-col items-center justify-center gap-1.5 rounded-md border p-3 text-center transition-colors min-h-[96px]";
              const stateCls = isCurrent
                ? "ring-2 ring-primary border-primary/40 bg-primary/5"
                : subscribed && url
                  ? "hover:bg-accent hover:border-accent-foreground/20 cursor-pointer"
                  : "opacity-50 bg-muted/30 cursor-not-allowed";

              const content = (
                <>
                  {isCurrent && (
                    <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary bg-background rounded-full" />
                  )}
                  {!subscribed && (
                    <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <Icon className="h-6 w-6 text-foreground" />
                  <span className="text-xs font-medium">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    {t(`suite.tile.${a.code}.desc`, "")}
                  </span>
                </>
              );

              if (isCurrent) {
                return (
                  <div key={a.code} className={`${baseCls} ${stateCls}`}>
                    {content}
                  </div>
                );
              }
              if (subscribed && url) {
                return (
                  <a
                    key={a.code}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${baseCls} ${stateCls}`}
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link key={a.code} to="/app/suite" className={`${baseCls} ${stateCls}`}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("suite.core", "Suite / Core")}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/app/suite/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings2 className="h-4 w-4 opacity-70" />
            <span>{t("suite.settings.title", "Suite Settings")}</span>
          </Link>
        </DropdownMenuItem>
        {canManageUsers && (
          <DropdownMenuItem asChild>
            <Link to="/app/people" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4 opacity-70" />
              <span>{t("suite.tile.users", "Users")}</span>
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
