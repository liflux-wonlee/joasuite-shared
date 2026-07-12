import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Mail,
  KeyRound,
  Pencil,
  Trash2,
  Plus,
  Building2,
  AppWindow,
} from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";
import { ROLES_BY_APP } from "../../constants";
import type { ManageableTenant, ManageableUserRow } from "../../types";

function rolesForApp(code: string): string[] {
  return (ROLES_BY_APP as Record<string, string[]>)[code] ?? ["owner", "super_admin", "approver"];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function UserDetailPage({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns } = useJoaSuite();
  const { Link, useNavigate } = router;
  const { user: me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const {
    Button,
    Input,
    Label,
    EmailInput,
    Badge,
    Checkbox,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
  } = ui;

  const { data, isLoading } = useQuery({
    queryKey: ["account-users"],
    queryFn: () => fns.listManageableUsers(),
  });
  const tenants: ManageableTenant[] = (data?.tenants as ManageableTenant[] | undefined) ?? [];
  const users: ManageableUserRow[] = (data?.users as ManageableUserRow[] | undefined) ?? [];
  const user = users.find((u) => u.user_id === userId);

  const tenantById = useMemo(() => {
    const m = new Map<string, ManageableTenant>();
    tenants.forEach((tn) => m.set(tn.id, tn));
    return m;
  }, [tenants]);

  const unassignedTenants = useMemo(
    () => tenants.filter((tn) => !user?.assignments[tn.id]),
    [tenants, user],
  );

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [addTenantId, setAddTenantId] = useState<string>("");
  const [addApps, setAddApps] = useState<Record<string, string>>({});

  const startEdit = () => {
    if (!user) return;
    setEditName(user.display_name ?? "");
    setEditEmail(user.email ?? "");
    setEditing(true);
  };

  const updateProfile = useMutation({
    mutationFn: (i: { user_id: string; display_name: string; email?: string }) =>
      fns.accountUpdateUserProfile(i),
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      qc.invalidateQueries({ queryKey: ["account-users"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: () => fns.accountResendInvitation({ user_id: userId }),
    onSuccess: () => toast.success(t("users.invite_resent", "Invitation resent")),
    onError: (e: Error) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => fns.accountSendPasswordReset({ user_id: userId }),
    onSuccess: () => toast.success(t("users.reset_sent", "Password reset link sent")),
    onError: (e: Error) => toast.error(e.message),
  });

  const setRoles = useMutation({
    mutationFn: (i: { tenant_id: string; app_code: string; roles: string[] }) =>
      fns.setUserAppRoles({
        tenant_id: i.tenant_id,
        user_id: userId,
        app_code: i.app_code,
        roles: i.roles as any,
      }),
    onSuccess: () => {
      toast.success(t("set.roles_updated", "Roles updated"));
      qc.invalidateQueries({ queryKey: ["account-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFromOrg = useMutation({
    mutationFn: (tenant_id: string) => fns.removeTenantUser({ tenant_id, user_id: userId }),
    onSuccess: () => {
      toast.success(t("set.user_removed", "User removed"));
      qc.invalidateQueries({ queryKey: ["account-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToOrg = useMutation({
    mutationFn: () => {
      if (!user?.email) throw new Error("User email missing");
      const apps = Object.entries(addApps).map(([app_code, role]) => ({
        app_code,
        roles: [role as any],
      }));
      return fns.inviteUserToWorkspaces({
        email: user.email,
        display_name: user.display_name ?? user.email,
        primary_tenant_id: addTenantId,
        assignments: [
          { tenant_id: addTenantId, portal: "internal" as const, apps },
        ],
      });
    },
    onSuccess: () => {
      toast.success(t("users.added_to_org", "Added to organization"));
      qc.invalidateQueries({ queryKey: ["account-users"] });
      setAddOrgOpen(false);
      setAddTenantId("");
      setAddApps({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }
  if (!user) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Link to="/app/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("users.back", "Back to Users")}
        </Link>
        <div className="border rounded-lg p-6 text-sm text-muted-foreground">
          {t("users.user_not_found", "User not found or you don't have access.")}
        </div>
      </div>
    );
  }

  const isSelf = me?.id === user.user_id;
  const memberships = Object.values(user.assignments);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/app/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("users.back", "Back to Users")}
      </Link>

      {/* Overview */}
      <section className="border rounded-lg bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{user.display_name ?? user.email ?? "—"}</h1>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="text-xs text-muted-foreground mt-2">
              {t("users.joined", "Joined")}: {formatDate(user.joined_at)} ·{" "}
              {t("users.last_active", "Last active")}: {formatDate(user.last_sign_in_at)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" /> {t("common.edit", "Edit")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>
              <Mail className="h-3.5 w-3.5" /> {t("users.resend_invite", "Resend invitation")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
              <KeyRound className="h-3.5 w-3.5" /> {t("users.send_reset", "Send password reset")}
            </Button>
          </div>
        </div>
      </section>

      {/* Organizations as tabs */}
      <section className="border rounded-lg bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {t("users.org_memberships", "Organization memberships")}
          </h2>
          {unassignedTenants.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAddTenantId(unassignedTenants[0].id);
                setAddApps({});
                setAddOrgOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {t("users.add_to_org", "Add to organization")}
            </Button>
          )}
        </div>

        {memberships.length === 0 ? (
          <div className="p-6 text-sm text-center text-muted-foreground">
            {t("users.no_memberships", "Not a member of any organization yet.")}
          </div>
        ) : (
          <Tabs defaultValue={memberships[0].tenant_id} className="w-full">
            <TabsList className="m-3 flex flex-wrap h-auto justify-start">
              {memberships.map((a) => {
                const tn = tenantById.get(a.tenant_id);
                return (
                  <TabsTrigger key={a.tenant_id} value={a.tenant_id} className="gap-2">
                    <span>{tn?.name ?? a.tenant_id}</span>
                    <Badge
                      variant={a.status === "active" ? "default" : "secondary"}
                      className="capitalize text-[10px] px-1.5 py-0"
                    >
                      {a.status}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {memberships.map((a) => {
              const tn = tenantById.get(a.tenant_id);
              if (!tn) return null;
              const subscribedCodes = tn.app_codes ?? [];
              const allCodes = Array.from(
                new Set([...subscribedCodes, ...Object.keys(a.apps)]),
              ).sort();
              const isOwner = Object.values(a.apps).some((v) => v.roles.includes("owner"));
              return (
                <TabsContent key={a.tenant_id} value={a.tenant_id} className="p-4 pt-2 space-y-4">
                  {/* Org summary */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {t("users.joined", "Joined")}: {formatDate(a.joined_at)}
                    </span>
                    <span>·</span>
                    <span>
                      {t("users.subscribed_apps", "Subscribed apps")}: {subscribedCodes.length}
                    </span>
                    <div className="ml-auto">
                      {!isSelf && !isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(t("set.remove_user_confirm", { name: user.display_name || user.email || user.user_id }))) {
                              removeFromOrg.mutate(a.tenant_id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("set.remove_user", "Remove from organization")}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* App access list */}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <AppWindow className="h-3.5 w-3.5" />
                      {t("users.app_access", "App access & roles")}
                    </div>
                    <div className="border rounded-md divide-y">
                      {allCodes.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">
                          {t("users.no_apps_subscribed_short", "This organization has no apps subscribed.")}
                        </div>
                      )}
                      {allCodes.map((code) => {
                        const subscribed = subscribedCodes.includes(code);
                        const plan = tn.app_plans?.[code] ?? null;
                        const currentRole = a.apps[code]?.roles[0] ?? "";
                        const hasAccess = !!currentRole;
                        const options = rolesForApp(code);
                        const isAppOwner = a.apps[code]?.roles.includes("owner") ?? false;
                        const lockSelf = isSelf && isAppOwner;
                        return (
                          <div key={code} className="flex items-center gap-3 p-3">
                            <Badge variant={subscribed ? "default" : "outline"} className="w-20 justify-center uppercase text-[10px]">
                              {code}
                            </Badge>
                            {subscribed ? (
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {plan ?? "—"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {t("users.not_subscribed", "Not subscribed")}
                              </Badge>
                            )}
                            <div className="flex-1">
                              {!subscribed ? (
                                <span className="text-xs text-muted-foreground">
                                  {t("users.org_not_subscribed_hint", "Organization is not subscribed to this app. Subscribe in Suite settings to assign roles.")}
                                </span>
                              ) : (
                                <Select
                                  value={hasAccess ? currentRole : "__none__"}
                                  onValueChange={(v: string) =>
                                    setRoles.mutate({
                                      tenant_id: a.tenant_id,
                                      app_code: code,
                                      roles: v === "__none__" ? [] : [v],
                                    })
                                  }
                                  disabled={lockSelf || !subscribed}
                                >
                                  <SelectTrigger className="h-8 text-xs max-w-xs">
                                    <SelectValue placeholder={t("set.select_role", "Select role")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__" className="text-xs text-muted-foreground">
                                      {t("users.no_access", "No access")}
                                    </SelectItem>
                                    {options.map((r) => (
                                      <SelectItem key={r} value={r} className="text-xs">
                                        {r}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </section>


      {/* Edit profile dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.user_details", "User details")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("account.display_name", "Name")}</Label>
              <Input value={editName} onChange={(e: any) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>{t("common.email")}</Label>
              <EmailInput value={editEmail} onChange={(e: any) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                const payload: { user_id: string; display_name: string; email?: string } = {
                  user_id: user.user_id,
                  display_name: editName.trim(),
                };
                if (editEmail && editEmail !== user.email) payload.email = editEmail.trim();
                updateProfile.mutate(payload);
              }}
              disabled={!editName.trim() || updateProfile.isPending}
            >
              {updateProfile.isPending ? t("set.sending") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to org dialog */}
      <Dialog open={addOrgOpen} onOpenChange={setAddOrgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.add_to_org", "Add to organization")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("users.organization", "Organization")}</Label>
              <Select
                value={addTenantId}
                onValueChange={(v: string) => {
                  setAddTenantId(v);
                  setAddApps({});
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unassignedTenants.map((tn) => (
                    <SelectItem key={tn.id} value={tn.id}>
                      {tn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addTenantId && (
              <div className="space-y-1.5">
                <Label>{t("users.app_roles", "App access & roles")}</Label>
                {(tenantById.get(addTenantId)?.app_codes ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {t("users.no_apps_subscribed_short", "This organization has no apps subscribed.")}
                  </div>
                ) : (
                  (tenantById.get(addTenantId)?.app_codes ?? []).map((code) => {
                    const checked = code in addApps;
                    const options = rolesForApp(code);
                    const role = addApps[code] ?? options[0];
                    return (
                      <div key={code} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v: boolean) => {
                            setAddApps((s) => {
                              const next = { ...s };
                              if (v) next[code] = role;
                              else delete next[code];
                              return next;
                            });
                          }}
                          id={`add-app-${code}`}
                        />
                        <label htmlFor={`add-app-${code}`} className="w-20 uppercase cursor-pointer">
                          {code}
                        </label>
                        <Select
                          value={role}
                          onValueChange={(v: string) => setAddApps((s) => ({ ...s, [code]: v }))}
                          disabled={!checked}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOrgOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => addToOrg.mutate()}
              disabled={!addTenantId || addToOrg.isPending}
            >
              {addToOrg.isPending ? t("set.sending") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
