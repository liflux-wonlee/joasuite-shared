import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { User as UserIcon, Shield, Briefcase, CreditCard, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserBadge() {
  const { t } = useTranslation();
  const { user, currentMembership, currentTenantId, signOut } = useAuth();

  const { data } = useQuery({
    queryKey: ["user-badge", user?.id, currentTenantId],
    enabled: !!user && !!currentTenantId,
    queryFn: async () => {
      const [current, all] = await Promise.all([
        supabase
          .from("tenant_users")
          .select("display_name, email, position")
          .eq("user_id", user!.id)
          .eq("tenant_id", currentTenantId!)
          .maybeSingle(),
        supabase
          .from("tenant_users")
          .select("display_name, email")
          .eq("user_id", user!.id),
      ]);
      return { current: current.data, all: all.data ?? [] };
    },
  });

  const current = data?.current;
  const rawDisplayName = (current?.display_name || "").trim();
  const email = (current?.email || user?.email || "").trim();
  const emailLc = email.toLowerCase();
  const isEmailish = (s: string) => !!s && s.toLowerCase() === emailLc;

  const fallbackName =
    (data?.all ?? [])
      .map((r) => (r.display_name || "").trim())
      .find((n) => n && !isEmailish(n)) || "";

  const metaName =
    ((user?.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined) ||
    ((user?.user_metadata as Record<string, unknown> | undefined)?.name as string | undefined) ||
    "";

  const nameLine =
    (rawDisplayName && !isEmailish(rawDisplayName) && rawDisplayName) ||
    fallbackName ||
    (metaName.trim() && !isEmailish(metaName.trim()) && metaName.trim()) ||
    "";


  const showName = !!nameLine;
  const showEmail = !!email;
  const position = current?.position || "";
  const roles = currentMembership?.roles ?? [];
  const roleLabel = roles[0]?.replace(/_/g, " ").toUpperCase();

  const ITEMS = [
    { to: "/app/account/profile", key: "profile", icon: UserIcon },
    { to: "/app/account/security", key: "security", icon: Shield },
    { to: "/app/account/organizations", key: "organizations", icon: Briefcase },
    { to: "/app/account/billing", key: "billing", icon: CreditCard },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="min-w-0 leading-tight text-left rounded px-2 py-1 hover:bg-muted transition">
          {showName && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold truncate">{nameLine}</span>
              {roleLabel && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {roleLabel}
                </span>
              )}
            </div>
          )}
          {showEmail && (
            <div className="text-[10px] font-normal text-muted-foreground/50 truncate">{email}</div>
          )}
          {position && (
            <div className="text-[10px] text-muted-foreground/60 truncate">{position}</div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          {showName && <div className="text-sm font-medium truncate">{nameLine}</div>}
          {showEmail && (
            <div className="text-xs text-muted-foreground truncate">{email}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <DropdownMenuItem key={it.key} asChild>
              <Link to={it.to} className="cursor-pointer">
                <Icon className="h-4 w-4 mr-2" />
                {t(`account.nav.${it.key}`)}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
          <LogOut className="h-4 w-4 mr-2" />
          {t("common.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
