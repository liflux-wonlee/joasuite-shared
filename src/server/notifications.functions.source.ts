import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      .or("app_code.eq.joabooks,app_code.is.null")
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
      .or("app_code.eq.joabooks,app_code.is.null")
      .is("read_at", null);

    return { rows: rows ?? [], unread_count: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
