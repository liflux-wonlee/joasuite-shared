import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../context";
import { APP_DISPLAY } from "../constants";

/**
 * Renders `children` once the signed-in user has an active membership in a
 * tenant that's subscribed to the current app. Otherwise renders the branch
 * that applies:
 *   - no membership anywhere -> create an organization
 *   - owner/super_admin of a tenant that hasn't enabled this app -> one-click subscribe
 *   - member (non-owner) of a tenant that hasn't enabled this app -> ask the owner
 * All three reuse existing primitives (createTenant / subscribeApp) - no new
 * server functions. Membership existence itself is never revealed pre-auth;
 * this component only runs post-authentication.
 */
export function PostLoginGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { useAuth, ui, router, fns, currentApp } = useJoaSuite();
  const { Button, Card, Input, Label } = ui;
  const { useNavigate } = router;
  const nav = useNavigate();
  const qc = useQueryClient();
  const { currentMembership, setCurrentTenantId, refresh } = useAuth();

  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const appName = APP_DISPLAY.find((a) => a.code === currentApp)?.name ?? currentApp;

  if (currentMembership?.apps?.includes(currentApp)) {
    return <>{children}</>;
  }

  const isOwner =
    !!currentMembership &&
    (currentMembership.roles.includes("owner") || currentMembership.roles.includes("super_admin"));

  const goToApp = async (tenantId: string) => {
    await refresh();
    setCurrentTenantId(tenantId);
    qc.invalidateQueries();
    nav({ to: "/app" });
  };

  const handleCreateOrg = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      const res = await fns.createTenant({ name: orgName.trim() });
      if (!res?.tenant?.id) throw new Error("No tenant returned");
      toast.success(t("suite.gate.org_created", "Organization created"));
      await goToApp(res.tenant.id);
    } catch (err: any) {
      toast.error(err?.message ?? t("suite.gate.create_failed", "Failed to create organization"));
    } finally {
      setCreating(false);
    }
  };

  const handleSubscribe = async () => {
    if (!currentMembership) return;
    setSubscribing(true);
    try {
      await fns.subscribeApp({ tenantId: currentMembership.tenant_id, appCode: currentApp, plan: "free" });
      toast.success(t("suite.gate.subscribed", "{{app}} is now enabled", { app: appName }));
      await goToApp(currentMembership.tenant_id);
    } catch (err: any) {
      toast.error(err?.message ?? t("suite.gate.subscribe_failed", "Failed to subscribe"));
    } finally {
      setSubscribing(false);
    }
  };

  const newOrgForm = (
    <form onSubmit={handleCreateOrg} className="space-y-3 text-left">
      <div className="space-y-1.5">
        <Label htmlFor="gate-org-name">{t("suite.gate.org_name_label", "Organization name")}</Label>
        <Input
          id="gate-org-name"
          value={orgName}
          onChange={(e: any) => setOrgName(e.target.value)}
          placeholder="Acme Trading LLC"
          autoFocus
          required
        />
      </div>
      <Button type="submit" disabled={creating || !orgName.trim()} className="w-full">
        {creating ? t("suite.gate.creating", "Creating…") : t("suite.gate.create_org", "Create organization")}
      </Button>
    </form>
  );

  const separateOrgToggle = !creatingOrg && (
    <button
      type="button"
      onClick={() => setCreatingOrg(true)}
      className="mx-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      {t("suite.gate.separate_org_cta", "Need this for something unrelated? Create a separate organization")}
      <ArrowRight className="h-3 w-3" />
    </button>
  );

  const backToggle = creatingOrg && (
    <button
      type="button"
      onClick={() => setCreatingOrg(false)}
      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      {t("common.back", "Back")}
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>

        {!currentMembership ? (
          <>
            <div>
              <h1 className="text-lg font-semibold">
                {t("suite.gate.no_org_title", "Create your organization")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t(
                  "suite.gate.no_org_desc",
                  "Your account isn't part of any organization yet. Create one to get started.",
                )}
              </p>
            </div>
            {newOrgForm}
          </>
        ) : isOwner ? (
          <>
            <div>
              <h1 className="text-lg font-semibold">
                {t("suite.gate.owner_title", "{{tenant}} hasn't enabled {{app}} yet", {
                  tenant: currentMembership.tenant_name,
                  app: appName,
                })}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("suite.gate.owner_desc", "Subscribe your organization to {{app}} to continue.", {
                  app: appName,
                })}
              </p>
            </div>
            {!creatingOrg ? (
              <div className="space-y-2">
                <Button onClick={handleSubscribe} disabled={subscribing} className="w-full">
                  {subscribing
                    ? t("suite.gate.subscribing", "Subscribing…")
                    : t("suite.gate.subscribe_cta", "Subscribe {{app}}", { app: appName })}
                </Button>
                {separateOrgToggle}
              </div>
            ) : (
              <div className="space-y-2">
                {newOrgForm}
                {backToggle}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold">
                {t("suite.gate.member_title", "{{tenant}} doesn't use {{app}} yet", {
                  tenant: currentMembership.tenant_name,
                  app: appName,
                })}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t(
                  "suite.gate.member_desc",
                  "You're registered at {{tenant}} as {{role}}. Ask the organization owner to subscribe to {{app}} to get access.",
                  {
                    tenant: currentMembership.tenant_name,
                    role: currentMembership.roles[0] ?? "member",
                    app: appName,
                  },
                )}
              </p>
            </div>
            {!creatingOrg ? (
              separateOrgToggle
            ) : (
              <div className="space-y-2">
                {newOrgForm}
                {backToggle}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
