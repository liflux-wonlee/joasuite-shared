import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Deps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
  appCode: string;
  /**
   * When true, the bell shows notifications from EVERY app the user has
   * (a single unified cross-app bell), tagging each row with its source
   * app_code so the UI can badge/deep-link non-current-app notifications.
   * When false/omitted, only this app's own rows (+ app_code IS NULL
   * suite-wide rows) are returned - the original, narrower behavior.
   */
  crossApp?: boolean;
};

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
        .select("id, kind, title, body, link_path, read_at, created_at, app_code")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (!deps.crossApp) q = q.or(`app_code.eq.${deps.appCode},app_code.is.null`);
      if (data.unread_only) q = q.is("read_at", null);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);

      // Unread count (separate, always full) - scoped the same way as the list.
      let countQ = context.supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", context.userId)
        .is("read_at", null);
      if (!deps.crossApp) countQ = countQ.or(`app_code.eq.${deps.appCode},app_code.is.null`);
      const { count } = await countQ;

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
