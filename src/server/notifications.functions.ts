import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Deps = { requireSupabaseAuth: any; supabaseAdmin: any; appCode: string };

export function createListNotifications(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        unread_only: z.boolean().default(false),
        limit: z.number().int().min(1).max(100).default(30),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      let q = context.supabase
        .from("notifications")
        .select("id, kind, title, body, link_path, read_at, created_at")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", context.userId)
        .or(`app_code.eq.${deps.appCode},app_code.is.null`)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (data.unread_only) q = q.is("read_at", null);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);

      // Unread count (separate, always full)
      const { count } = await context.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", context.userId)
        .or(`app_code.eq.${deps.appCode},app_code.is.null`)
        .is("read_at", null);

      return { rows: rows ?? [], unread_count: count ?? 0 };
    });
}

export function createMarkNotificationRead(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const { error } = await deps.supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createMarkAllNotificationsRead(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const { error } = await deps.supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", context.userId)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}
