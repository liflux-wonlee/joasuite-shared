import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TenantInput = z.object({ tenantId: z.string().uuid() });

export type AppCatalogEntry = {
  code: string;
  name: string;
  description: string | null;
  plans: Array<{ code: string; name: string }>;
  sort_order: number;
};

export type TenantAppRow = {
  app_code: string;
  plan: string;
  status: string;
  activated_at: string;
  canceled_at: string | null;
  deletion_scheduled_at: string | null;
};

const SubInput = z.object({
  tenantId: z.string().uuid(),
  appCode: z.string().min(1).max(64),
  plan: z.string().min(1).max(64).default("basic"),
});

// `has_any_role` (unlike the scoped `has_any_role_scoped(..., _app_code)`
// RPC) has no app_code parameter at all - it matches a role by name
// regardless of which app it was granted for. This used to be treated as
// "safe for owner/super_admin, always suite-wide by convention" and fall
// back to the unscoped RPC whenever a caller didn't supply appCode - but
// that convention isn't actually enforced anywhere on the write side
// (account.server.ts's invite/role-grant path stores whatever app_code the
// caller selected, including for owner/super_admin), so an owner scoped to
// one app could subscribe/cancel a DIFFERENT app's subscription for the
// same tenant. `appCode` is now required and the check always goes through
// `has_any_role_scoped`, which still passes for a genuinely suite-wide
// owner/super_admin row (app_code IS NULL) - only a same-name role scoped
// to a different app now correctly fails.
async function assertOwner(deps: Deps, supabase: any, tenantId: string, userId: string) {
  const { data: ok, error } = await supabase.rpc("has_any_role_scoped", {
    _tenant: tenantId,
    _user: userId,
    _roles: ["owner", "super_admin"],
    _app_code: deps.appCode,
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("Forbidden");
}

type Deps = { requireSupabaseAuth: any; appCode: string };

export function createListSuiteApps(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) => TenantInput.parse(d))
    .handler(async ({ data, context }) => {
      const { supabase, userId } = context;

      const { data: member } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", data.tenantId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) throw new Error("Forbidden");

      const [
        { data: catalog, error: catErr },
        { data: subs, error: subErr },
        { data: myRoles, error: rErr },
      ] = await Promise.all([
        supabase
          .from("app_catalog")
          .select("code, name, description, plans, sort_order")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("tenant_apps")
          .select("app_code, plan, status, activated_at, canceled_at, deletion_scheduled_at")
          .eq("tenant_id", data.tenantId),
        supabase
          .from("user_roles")
          .select("app_code")
          .eq("tenant_id", data.tenantId)
          .eq("user_id", userId),
      ]);
      if (catErr) throw catErr;
      if (subErr) throw subErr;
      if (rErr) throw rErr;

      const myAppCodes: string[] = Array.from(
        new Set<string>((myRoles ?? []).map((r: any) => (r.app_code as string) ?? "joabooks")),
      );

      return {
        catalog: (catalog ?? []) as AppCatalogEntry[],
        subscriptions: (subs ?? []) as TenantAppRow[],
        myAppCodes,
      };
    });
}

export function createSubscribeApp(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) => SubInput.parse(d))
    .handler(async ({ data, context }) => {
      await assertOwner(deps, context.supabase, data.tenantId, context.userId);
      const { error } = await context.supabase
        .from("tenant_apps")
        .upsert(
          {
            tenant_id: data.tenantId,
            app_code: data.appCode,
            plan: data.plan,
            status: "active",
            canceled_at: null,
            deletion_scheduled_at: null,
            activated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,app_code" },
        );
      if (error) throw error;
      return { ok: true as const };
    });
}

export function createCancelApp(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) =>
      z.object({ tenantId: z.string().uuid(), appCode: z.string().min(1).max(64) }).parse(d),
    )
    .handler(async ({ data, context }) => {
      await assertOwner(deps, context.supabase, data.tenantId, context.userId);
      // An app can't cancel its own subscription from within itself.
      if (data.appCode === deps.appCode) {
        throw new Error("This app cannot be canceled here");
      }
      const { error } = await context.supabase
        .from("tenant_apps")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("tenant_id", data.tenantId)
        .eq("app_code", data.appCode);
      if (error) throw error;
      return { ok: true as const };
    });
}
