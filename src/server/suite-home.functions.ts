import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TenantInput = z.object({ tenantId: z.string().uuid() });

const APP_URL_KEYS = [
  "app_url.joabooks",
  "app_url.joaapproval",
  "app_url.joacrm",
  "app_url.joaoffice",
  "app_url.joasop",
] as const;

export type SuiteHomeData = {
  appUrls: Record<string, string>;
  myApprovals: Array<{
    id: string;
    doc_kind: string;
    doc_id: string;
    sequence_no: number | null;
    created_at: string;
    title: string | null;
    amount_usd: number | null;
    due_date: string | null;
    source_app: string;
    link_path: string | null;
  }>;
  requestedByMe: Array<{
    id: string;
    kind: "payment_request" | "bill";
    no: string | null;
    status: string;
    amount_usd: number | null;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    kind: string;
    title: string;
    body: string | null;
    link_path: string | null;
    read_at: string | null;
    created_at: string;
    app_code: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    record_type: string;
    record_id: string;
    user_name: string | null;
    created_at: string;
    app_code: string | null;
  }>;
};

type Deps = { requireSupabaseAuth: any; supabaseAdmin?: any; appCode?: string };

// See suite.functions.ts's assertOwner comment: has_any_role has no
// app_code parameter, so it's only safe for owner/super_admin (always
// suite-wide). When deps.supabaseAdmin + deps.appCode are supplied, check
// user_roles directly with app_code scoping to support app-scoped 'admin'
// correctly; otherwise fall back to the original owner/super_admin-only RPC.
async function assertOwnerOrAdmin(deps: Deps, supabase: any, tenantId: string, userId: string) {
  if (deps.supabaseAdmin && deps.appCode) {
    const { data, error } = await deps.supabaseAdmin
      .from("user_roles")
      .select("role, app_code")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const ok = (data ?? []).some((r: any) => {
      const role = r.role as string;
      const appCode = r.app_code as string | null;
      if (appCode === null) return role === "owner" || role === "super_admin";
      return appCode === deps.appCode && role === "admin";
    });
    if (!ok) throw new Error("Forbidden");
    return;
  }
  const { data: ok } = await supabase.rpc("has_any_role", {
    _tenant: tenantId,
    _user: userId,
    _roles: ["owner", "super_admin"],
  });
  if (!ok) throw new Error("Forbidden");
}

export function createGetSuiteHome(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) => TenantInput.parse(d))
    .handler(async ({ data, context }): Promise<SuiteHomeData> => {
      const { supabase, userId } = context;
      const tenantId = data.tenantId;

      // membership check
      const { data: member } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!member) throw new Error("Forbidden");

      const [
        { data: settings },
        { data: approvals },
        { data: prs },
        { data: bills },
        { data: notifs },
        { data: activity },
      ] = await Promise.all([
        supabase
          .from("settings_kv")
          .select("key, value")
          .eq("tenant_id", tenantId)
          .in("key", APP_URL_KEYS as unknown as string[]),
        supabase
          .from("approvals")
          .select("id, doc_kind, doc_id, sequence_no, created_at, source_app, meta, link_path")
          .eq("tenant_id", tenantId)
          .eq("assigned_to", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("payment_requests")
          .select("id, request_no, status, amount_usd, created_at, due_date")
          .eq("tenant_id", tenantId)
          .eq("submitted_by", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("bills")
          .select("id, bill_no, status, amount_usd, created_at, due_date")
          .eq("tenant_id", tenantId)
          .eq("created_by", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("notifications")
          .select("id, kind, title, body, link_path, read_at, created_at, app_code")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("audit_logs")
          .select("id, action, record_type, record_id, user_name, created_at, app_code")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Resolve approval titles for payment_requests/bills/expenses/invoices
      const prIds = (approvals ?? [])
        .filter((a: any) => a.doc_kind === "payment_request")
        .map((a: any) => a.doc_id);
      const billIds = (approvals ?? [])
        .filter((a: any) => a.doc_kind === "bill")
        .map((a: any) => a.doc_id);
      const expIds = (approvals ?? [])
        .filter((a: any) => a.doc_kind === "expense")
        .map((a: any) => a.doc_id);
      const invIds = (approvals ?? [])
        .filter((a: any) => a.doc_kind === "invoice")
        .map((a: any) => a.doc_id);

      const [prTitles, billTitles, expTitles, invTitles] = await Promise.all([
        prIds.length
          ? supabase
              .from("payment_requests")
              .select("id, request_no, amount_usd, due_date")
              .in("id", prIds)
          : Promise.resolve({ data: [] as any[] }),
        billIds.length
          ? supabase
              .from("bills")
              .select("id, bill_no, amount_usd, due_date")
              .in("id", billIds)
          : Promise.resolve({ data: [] as any[] }),
        expIds.length
          ? supabase
              .from("expenses")
              .select("id, expense_no, amount_usd")
              .in("id", expIds)
          : Promise.resolve({ data: [] as any[] }),
        invIds.length
          ? supabase
              .from("invoices")
              .select("id, invoice_no, amount_usd, due_date")
              .in("id", invIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const titleFor = (kind: string, id: string) => {
        const m =
          kind === "payment_request"
            ? (prTitles.data ?? []).find((r: any) => r.id === id)
            : kind === "bill"
              ? (billTitles.data ?? []).find((r: any) => r.id === id)
              : kind === "expense"
                ? (expTitles.data ?? []).find((r: any) => r.id === id)
                : kind === "invoice"
                  ? (invTitles.data ?? []).find((r: any) => r.id === id)
                  : null;
        if (!m) return { title: null as string | null, amount_usd: null, due_date: null };
        return {
          title: (m.request_no || m.bill_no || m.expense_no || m.invoice_no) ?? null,
          amount_usd: m.amount_usd ?? null,
          due_date: m.due_date ?? null,
        };
      };

      const appUrls: Record<string, string> = {};
      for (const row of (settings ?? []) as Array<{ key: string; value: any }>) {
        const code = row.key.replace(/^app_url\./, "");
        const v = typeof row.value === "string" ? row.value : (row.value?.url ?? "");
        if (v) appUrls[code] = v;
      }

      // Only surface approvals from apps this tenant is currently subscribed
      // to (contract §9.3) - a canceled app's approvals must not linger here.
      const { data: activeApps } = await supabase
        .from("tenant_apps")
        .select("app_code")
        .eq("tenant_id", tenantId)
        .eq("status", "active");
      const subscribed = new Set((activeApps ?? []).map((r: any) => r.app_code));

      // Infer the writing app from the doc_kind prefix when source_app is
      // absent (legacy finance kinds predating source_app have no prefix).
      const inferApp = (a: any): string => {
        if (a.source_app) return a.source_app;
        const k = String(a.doc_kind ?? "");
        return k.includes(".") ? k.split(".")[0] : "joabooks";
      };

      return {
        appUrls,
        myApprovals: (approvals ?? [])
          .filter((a: any) => subscribed.size === 0 || subscribed.has(inferApp(a)))
          .map((a: any) => {
            const meta = (a.meta && typeof a.meta === "object" ? a.meta : {}) as Record<string, any>;
            const t = titleFor(a.doc_kind, a.doc_id);
            // Prefer the cross-app `meta` snapshot, then the JoaBooks title
            // resolver, else a generic label derived from doc_kind.
            const title =
              meta.title ??
              t.title ??
              String(a.doc_kind ?? "").replace(/^[a-z]+\./, "").replace(/_/g, " ") ??
              null;
            return {
              id: a.id,
              doc_kind: a.doc_kind,
              doc_id: a.doc_id,
              sequence_no: a.sequence_no,
              created_at: a.created_at,
              title,
              amount_usd: meta.amount ?? t.amount_usd ?? null,
              due_date: meta.due_date ?? t.due_date ?? null,
              source_app: inferApp(a),
              link_path: a.link_path ?? null,
            };
          }),
        requestedByMe: [
          ...(prs ?? []).map((r: any) => ({
            id: r.id,
            kind: "payment_request" as const,
            no: r.request_no,
            status: r.status,
            amount_usd: r.amount_usd,
            created_at: r.created_at,
          })),
          ...(bills ?? []).map((r: any) => ({
            id: r.id,
            kind: "bill" as const,
            no: r.bill_no,
            status: r.status,
            amount_usd: r.amount_usd,
            created_at: r.created_at,
          })),
        ]
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, 8),
        notifications: (notifs ?? []) as any,
        recentActivity: (activity ?? []) as any,
      };
    });
}

const SetAppUrlInput = z.object({
  tenantId: z.string().uuid(),
  appCode: z.enum(["joabooks", "joaapproval", "joacrm", "joaoffice", "joasop"]),
  url: z
    .string()
    .max(2048)
    .refine(
      (u) => u === "" || /^https?:\/\//i.test(u),
      { message: "URL must start with http:// or https://" }
    )
    .or(z.literal("")),
});

export function createSetAppUrl(deps: Deps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) => SetAppUrlInput.parse(d))
    .handler(async ({ data, context }) => {
      const { supabase, userId } = context;
      await assertOwnerOrAdmin(deps, supabase, data.tenantId, userId);
      const key = `app_url.${data.appCode}`;
      if (!data.url) {
        const { error } = await supabase
          .from("settings_kv")
          .delete()
          .eq("tenant_id", data.tenantId)
          .eq("key", key);
        if (error) throw error;
        return { ok: true };
      }
      const { error } = await supabase
        .from("settings_kv")
        .upsert(
          { tenant_id: data.tenantId, key, value: data.url, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,key" },
        );
      if (error) throw error;
      return { ok: true };
    });
}
