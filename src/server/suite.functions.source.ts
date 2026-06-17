import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const listSuiteApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const myAppCodes = Array.from(
      new Set((myRoles ?? []).map((r) => (r.app_code as string) ?? "joabooks")),
    );

    return {
      catalog: (catalog ?? []) as AppCatalogEntry[],
      subscriptions: (subs ?? []) as TenantAppRow[],
      myAppCodes,
    };
  });

const SubInput = z.object({
  tenantId: z.string().uuid(),
  appCode: z.string().min(1).max(64),
  plan: z.string().min(1).max(64).default("free"),
});

async function assertOwner(supabase: any, tenantId: string, userId: string) {
  const { data: ok } = await supabase.rpc("has_any_role", {
    _tenant: tenantId,
    _user: userId,
    _roles: ["owner", "super_admin"],
  });
  if (!ok) throw new Error("Forbidden");
}

export const subscribeApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SubInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.tenantId, context.userId);
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
    return { ok: true };
  });

export const cancelApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ tenantId: z.string().uuid(), appCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.tenantId, context.userId);
    if (data.appCode === "joabooks") throw new Error("JoaBooks cannot be canceled here");
    const { error } = await context.supabase
      .from("tenant_apps")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("tenant_id", data.tenantId)
      .eq("app_code", data.appCode);
    if (error) throw error;
    return { ok: true };
  });
