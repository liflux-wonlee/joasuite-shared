import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

import {
  listManageableUsers,
  inviteUserToWorkspaces,
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailInput } from "@/components/ui/email-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ROLES_BY_APP } from "./app.people.$userId";

export const Route = createFileRoute("/app/people/invite")({ component: InvitePage });

type Tenant = { id: string; name: string; slug: string; app_codes: string[] };

function rolesForApp(code: string): string[] {
  return ROLES_BY_APP[code] ?? ["owner", "super_admin", "approver"];
}

type PresetKey = "owner_admin" | "manager" | "finance_staff" | "field_tech" | "approver" | "custom";

function applyPreset(preset: PresetKey, appCode: string): string | null {
  // returns role for this app, or null = no access
  switch (preset) {
    case "owner_admin":
      if (rolesForApp(appCode).includes("owner")) return "owner";
      return rolesForApp(appCode)[0] ?? null;
    case "manager":
      if (appCode === "joabooks") return "finance_manager";
      if (appCode === "joasop") return "sop_admin";
      return "super_admin";
    case "finance_staff":
      if (appCode === "joabooks") return "finance_ap";
      return null;
    case "field_tech":
      if (appCode === "joabooks") return "approver";
      return null;
    case "approver":
      if (appCode === "joasop") return "sop_reviewer";
      if (appCode === "joabooks") return "approver";
      return rolesForApp(appCode).includes("approver") ? "approver" : null;
    case "custom":
    default:
      return null;
  }
}

function InvitePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const usersFn = useServerFn(listManageableUsers);
  const inviteFn = useServerFn(inviteUserToWorkspaces);

  const { data, isLoading } = useQuery({
    queryKey: ["account-people"],
    queryFn: () => usersFn(),
  });
  const tenants: Tenant[] = (data?.tenants as Tenant[] | undefined) ?? [];
  const ownerTenantIds = new Set<string>(
    (data?.caller_owner_tenant_ids as string[] | undefined) ?? [],
  );
  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    tenants.forEach((tn) => m.set(tn.id, tn));
    return m;
  }, [tenants]);

  const rolesForAppTid = (tid: string, code: string): string[] => {
    const opts = rolesForApp(code);
    return ownerTenantIds.has(tid) ? opts : opts.filter((r) => r !== "owner");
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [primaryTenantId, setPrimaryTenantId] = useState<string>("");
  const [preset, setPreset] = useState<PresetKey>("custom");
  // selections[tenantId][appCode] = role string
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({});

  const toggleOrg = (id: string, checked: boolean) => {
    setOrgIds((prev) => {
      const next = checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id);
      if (!next.includes(primaryTenantId)) setPrimaryTenantId(next[0] ?? "");
      return next;
    });
  };

  const applyPresetToAll = (p: PresetKey) => {
    setPreset(p);
    const next: Record<string, Record<string, string>> = {};
    for (const tid of orgIds) {
      const tn = tenantById.get(tid);
      if (!tn) continue;
      next[tid] = {};
      for (const code of tn.app_codes) {
        let role = applyPreset(p, code);
        if (role === "owner" && !ownerTenantIds.has(tid)) {
          const fallback = rolesForAppTid(tid, code)[0] ?? null;
          role = fallback;
        }
        if (role) next[tid][code] = role;
      }
    }
    setSelections(next);
  };

  const setAppRole = (tid: string, code: string, role: string | null) => {
    if (role === "owner") {
      if (!ownerTenantIds.has(tid)) {
        toast.error(
          t(
            "people.owner_requires_owner",
            "Only an Owner can grant the Owner role to another user.",
          ),
        );
        return;
      }
      const ok = window.confirm(
        t(
          "people.confirm_owner_grant",
          "You're about to grant Owner access. Owners have full control of the organization, including the ability to remove other owners and delete the workspace. Continue?",
        ),
      );
      if (!ok) return;
    }
    setSelections((s) => {
      const cur = { ...(s[tid] ?? {}) };
      if (role) cur[code] = role;
      else delete cur[code];
      return { ...s, [tid]: cur };
    });
  };

  const invite = useMutation({
    mutationFn: () => {
      const assignments = orgIds.map((tid) => {
        const apps = Object.entries(selections[tid] ?? {}).map(([app_code, role]) => ({
          app_code,
          roles: [role as any],
        }));
        return { tenant_id: tid, portal: "internal" as const, apps };
      });
      return inviteFn({
        data: {
          email,
          display_name: displayName,
          primary_tenant_id: primaryTenantId || undefined,
          assignments,
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(
        res?.created
          ? t("people.invited", "Invited to {{count}} organization(s)", {
              count: res.tenants_added,
            })
          : t("people.added_existing", "Added existing user to {{count}} organization(s)", {
              count: res.tenants_added,
            }),
      );
      nav({ to: "/app/people" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const canNext: Record<number, boolean> = {
    1: !!email && !!displayName.trim(),
    2: orgIds.length > 0 && !!primaryTenantId,
    3: true,
    4: true,
    5: true,
  };

  const PRESETS: { key: PresetKey; label: string }[] = [
    { key: "owner_admin", label: t("people.preset_owner_admin", "Owner / Admin") },
    { key: "manager", label: t("people.preset_manager", "Manager") },
    { key: "finance_staff", label: t("people.preset_finance_staff", "Finance staff") },
    { key: "field_tech", label: t("people.preset_field_tech", "Field technician") },
    { key: "approver", label: t("people.preset_approver", "Approver") },
    { key: "custom", label: t("people.preset_custom", "Custom") },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Link to="/app/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("people.back", "Back to People")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{t("people.invite", "Invite person")}</h1>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center gap-1">
              <div
                className={`h-6 w-6 rounded-full grid place-content-center text-[11px] ${
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                      ? "bg-primary/30 text-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              {n < 5 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg bg-card p-5 space-y-4">
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="font-semibold">{t("people.step_person", "Step 1 · Person")}</h2>
            <div>
              <Label>{t("common.email")} *</Label>
              <EmailInput value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>{t("account.display_name", "Name")} *</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="font-semibold">{t("people.step_org", "Step 2 · Organization")}</h2>
            <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
              {tenants.map((tn) => (
                <label key={tn.id} className="flex items-center gap-3 p-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={orgIds.includes(tn.id)}
                    onCheckedChange={(v) => toggleOrg(tn.id, !!v)}
                  />
                  <span className="flex-1">{tn.name}</span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {tn.app_codes.join(", ") || "—"}
                  </span>
                </label>
              ))}
            </div>
            {orgIds.length > 0 && (
              <div>
                <Label>{t("people.primary_org", "Primary organization (for invitation email & login)")}</Label>
                <Select value={primaryTenantId} onValueChange={setPrimaryTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("people.choose_primary", "Choose primary org")} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {tenantById.get(id)?.name ?? id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h2 className="font-semibold">{t("people.step_preset", "Step 3 · Access preset")}</h2>
            <p className="text-xs text-muted-foreground">
              {t(
                "people.preset_hint",
                "Pick a preset to fill app roles, then adjust in the next step.",
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant={preset === p.key ? "default" : "outline"}
                  onClick={() => applyPresetToAll(p.key)}
                  className="h-auto py-3"
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold">{t("people.step_apps", "Step 4 · App access")}</h2>
            {orgIds.map((tid) => {
              const tn = tenantById.get(tid);
              if (!tn) return null;
              return (
                <div key={tid} className="border rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">{tn.name}</div>
                  {tn.app_codes.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {t(
                        "people.no_apps_subscribed_short",
                        "This organization has no apps subscribed.",
                      )}
                    </div>
                  ) : (
                    tn.app_codes.map((code) => {
                      const role = selections[tid]?.[code] ?? "";
                      const has = !!role;
                      const options = rolesForAppTid(tid, code);
                      return (
                        <div key={code} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={has}
                            onCheckedChange={(v) =>
                              setAppRole(tid, code, v ? (options.find((r) => r !== "owner") ?? options[0]) : null)
                            }
                            id={`s-${tid}-${code}`}
                          />
                          <label htmlFor={`s-${tid}-${code}`} className="w-20 uppercase cursor-pointer">
                            {code}
                          </label>
                          <Select
                            value={has ? role : options[0]}
                            onValueChange={(v) => setAppRole(tid, code, v)}
                            disabled={!has}
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
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <h2 className="font-semibold">{t("people.step_review", "Step 5 · Review & send")}</h2>
            <div className="text-sm space-y-2">
              <div>
                <span className="text-muted-foreground">{t("common.email")}:</span>{" "}
                <strong>{email}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">{t("account.display_name", "Name")}:</span>{" "}
                <strong>{displayName}</strong>
              </div>
              <div className="pt-2 space-y-2">
                {orgIds.map((tid) => {
                  const tn = tenantById.get(tid);
                  const apps = Object.entries(selections[tid] ?? {});
                  return (
                    <div key={tid} className="border rounded-md p-2">
                      <div className="font-medium">
                        {tn?.name}{" "}
                        {tid === primaryTenantId && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t("people.primary", "primary")}
                          </Badge>
                        )}
                      </div>
                      {apps.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {t("people.no_app_access", "No app access")}
                        </div>
                      ) : (
                        <ul className="text-xs text-muted-foreground list-disc pl-4">
                          {apps.map(([code, role]) => (
                            <li key={code}>
                              <span className="uppercase">{code}</span>: {role}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 1 ? nav({ to: "/app/people" }) : setStep((s) => (s - 1) as any))}
        >
          {step === 1 ? t("common.cancel") : t("common.back", "Back")}
        </Button>
        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => (s + 1) as any)}
            disabled={!canNext[step]}
          >
            {t("common.next", "Next")}
          </Button>
        ) : (
          <Button onClick={() => invite.mutate()} disabled={invite.isPending}>
            {invite.isPending
              ? t("set.sending", "Sending…")
              : t("people.send_invite", "Send invitation")}
          </Button>
        )}
      </div>
    </div>
  );
}
