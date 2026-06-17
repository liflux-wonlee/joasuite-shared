import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Mail, KeyRound, MoreHorizontal, Users as UsersIcon, Search } from "lucide-react";
import { toast } from "sonner";

import {
  listManageableUsers,
  accountResendInvitation,
  accountSendPasswordReset,
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/app/people/")({ component: PeopleListPage });

type Assignment = {
  tenant_id: string;
  portal: string;
  status: string;
  joined_at: string | null;
  apps: Record<string, { roles: string[] }>;
};
type UserRowT = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  assignments: Record<string, Assignment>;
};
type Tenant = { id: string; name: string; slug: string; app_codes: string[] };

function deriveStatus(u: UserRowT): "active" | "invited" | "suspended" {
  const vals = Object.values(u.assignments);
  if (vals.length === 0) return "invited";
  if (vals.every((a) => a.status === "suspended")) return "suspended";
  if (u.last_sign_in_at || vals.some((a) => a.joined_at)) return "active";
  return "invited";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function PeopleListPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const usersFn = useServerFn(listManageableUsers);
  const resendFn = useServerFn(accountResendInvitation);
  const resetFn = useServerFn(accountSendPasswordReset);

  const { data, isLoading } = useQuery({
    queryKey: ["account-people"],
    queryFn: () => usersFn(),
  });
  const tenants: Tenant[] = (data?.tenants as Tenant[] | undefined) ?? [];
  const users: UserRowT[] = (data?.users as UserRowT[] | undefined) ?? [];

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const allAppCodes = useMemo(() => {
    const s = new Set<string>();
    tenants.forEach((tn) => tn.app_codes.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.display_name ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (orgFilter !== "all" && !u.assignments[orgFilter]) return false;
      if (appFilter !== "all") {
        const hasApp = Object.values(u.assignments).some(
          (a) => (a.apps[appFilter]?.roles.length ?? 0) > 0,
        );
        if (!hasApp) return false;
      }
      if (statusFilter !== "all" && deriveStatus(u) !== statusFilter) return false;
      return true;
    });
  }, [users, search, orgFilter, appFilter, statusFilter]);

  const resend = useMutation({
    mutationFn: (uid: string) => resendFn({ data: { user_id: uid } }),
    onSuccess: () => toast.success(t("people.invite_resent", "Invitation resent")),
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (uid: string) => resetFn({ data: { user_id: uid } }),
    onSuccess: () => toast.success(t("people.reset_sent", "Password reset link sent")),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <UsersIcon className="h-6 w-6" />
          {t("suite.tile.people", "People")}
        </h1>
        <div className="border rounded-lg p-6 bg-card text-sm text-muted-foreground text-center">
          {t("people.no_manageable_tenants", "You don't own or super-admin any organizations yet.")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            {t("suite.tile.people", "People")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "people.desc",
              "Manage users across all organizations where you are owner or super admin.",
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => nav({ to: "/app/people/invite" })}>
          <Plus className="h-4 w-4" />
          {t("people.invite", "Invite person")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("people.search_placeholder", "Search name or email")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("people.all_orgs", "All organizations")}</SelectItem>
            {tenants.map((tn) => (
              <SelectItem key={tn.id} value={tn.id}>
                {tn.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={appFilter} onValueChange={setAppFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("people.all_apps", "All apps")}</SelectItem>
            {allAppCodes.map((c) => (
              <SelectItem key={c} value={c} className="uppercase">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("people.all_status", "All status")}</SelectItem>
            <SelectItem value="active">{t("people.status_active", "Active")}</SelectItem>
            <SelectItem value="invited">{t("people.status_invited", "Invited")}</SelectItem>
            <SelectItem value="suspended">{t("people.status_suspended", "Suspended")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 min-w-[220px]">{t("people.col_name", "Name")}</th>
              <th className="px-3 py-2 min-w-[110px]">{t("people.col_status", "Status")}</th>
              <th className="px-3 py-2 min-w-[80px]">{t("people.col_orgs", "Orgs")}</th>
              <th className="px-3 py-2 min-w-[200px]">{t("people.col_apps", "Apps")}</th>
              <th className="px-3 py-2 min-w-[110px] whitespace-nowrap">
                {t("people.last_active", "Last active")}
              </th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  {t("set.no_members")}
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const status = deriveStatus(u);
              const orgCount = Object.keys(u.assignments).length;
              const appCodes = Array.from(
                new Set(
                  Object.values(u.assignments).flatMap((a) =>
                    Object.entries(a.apps)
                      .filter(([, v]) => v.roles.length > 0)
                      .map(([code]) => code),
                  ),
                ),
              ).sort();
              return (
                <tr
                  key={u.user_id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => nav({ to: "/app/people/$userId", params: { userId: u.user_id } })}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium truncate">{u.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        status === "active"
                          ? "default"
                          : status === "suspended"
                            ? "destructive"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {t(`people.status_${status}`, status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-sm">{orgCount}</td>
                  <td className="px-3 py-2">
                    {appCodes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {appCodes.slice(0, 3).map((c) => (
                          <Badge key={c} variant="outline" className="uppercase text-[10px]">
                            {c}
                          </Badge>
                        ))}
                        {appCodes.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{appCodes.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(u.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/app/people/$userId"
                            params={{ userId: u.user_id }}
                          >
                            {t("people.manage_access", "Manage access")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => resend.mutate(u.user_id)}
                          disabled={resend.isPending}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {t("people.resend_invite", "Resend invitation")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => reset.mutate(u.user_id)}
                          disabled={reset.isPending}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          {t("people.send_reset", "Send password reset")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
