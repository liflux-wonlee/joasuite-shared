import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// src/server/suite.functions.ts
var TenantInput = z.object({ tenantId: z.string().uuid() });
var SubInput = z.object({
  tenantId: z.string().uuid(),
  appCode: z.string().min(1).max(64),
  plan: z.string().min(1).max(64).default("basic")
});
async function assertOwner(deps, supabase, tenantId, userId) {
  if (deps.supabaseAdmin && deps.appCode) {
    const { data, error } = await deps.supabaseAdmin.from("user_roles").select("role, app_code").eq("tenant_id", tenantId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const ok2 = (data ?? []).some((r) => {
      const role = r.role;
      const appCode = r.app_code;
      if (appCode === null) return role === "owner" || role === "super_admin";
      return appCode === deps.appCode && role === "admin";
    });
    if (!ok2) throw new Error("Forbidden");
    return;
  }
  const { data: ok } = await supabase.rpc("has_any_role", {
    _tenant: tenantId,
    _user: userId,
    _roles: ["owner", "super_admin"]
  });
  if (!ok) throw new Error("Forbidden");
}
function createListSuiteApps(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((d) => TenantInput.parse(d)).handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase.from("tenant_users").select("tenant_id").eq("tenant_id", data.tenantId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (!member) throw new Error("Forbidden");
    const [
      { data: catalog, error: catErr },
      { data: subs, error: subErr },
      { data: myRoles, error: rErr }
    ] = await Promise.all([
      supabase.from("app_catalog").select("code, name, description, plans, sort_order").eq("is_active", true).order("sort_order"),
      supabase.from("tenant_apps").select("app_code, plan, status, activated_at, canceled_at, deletion_scheduled_at").eq("tenant_id", data.tenantId),
      supabase.from("user_roles").select("app_code").eq("tenant_id", data.tenantId).eq("user_id", userId)
    ]);
    if (catErr) throw catErr;
    if (subErr) throw subErr;
    if (rErr) throw rErr;
    const myAppCodes = Array.from(
      new Set((myRoles ?? []).map((r) => r.app_code ?? "joabooks"))
    );
    return {
      catalog: catalog ?? [],
      subscriptions: subs ?? [],
      myAppCodes
    };
  });
}
function createSubscribeApp(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((d) => SubInput.parse(d)).handler(async ({ data, context }) => {
    await assertOwner(deps, context.supabase, data.tenantId, context.userId);
    const { error } = await context.supabase.from("tenant_apps").upsert(
      {
        tenant_id: data.tenantId,
        app_code: data.appCode,
        plan: data.plan,
        status: "active",
        canceled_at: null,
        deletion_scheduled_at: null,
        activated_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "tenant_id,app_code" }
    );
    if (error) throw error;
    return { ok: true };
  });
}
function createCancelApp(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (d) => z.object({ tenantId: z.string().uuid(), appCode: z.string().min(1).max(64) }).parse(d)
  ).handler(async ({ data, context }) => {
    await assertOwner(deps, context.supabase, data.tenantId, context.userId);
    if (data.appCode === (deps.appCode ?? "joabooks")) {
      throw new Error("This app cannot be canceled here");
    }
    const { error } = await context.supabase.from("tenant_apps").update({ status: "canceled", canceled_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("tenant_id", data.tenantId).eq("app_code", data.appCode);
    if (error) throw error;
    return { ok: true };
  });
}
var TenantInput2 = z.object({ tenantId: z.string().uuid() });
var APP_URL_KEYS = [
  "app_url.joabooks",
  "app_url.joaapproval",
  "app_url.joacrm",
  "app_url.joaoffice",
  "app_url.joasop"
];
async function assertOwnerOrAdmin(deps, supabase, tenantId, userId) {
  if (deps.supabaseAdmin && deps.appCode) {
    const { data, error } = await deps.supabaseAdmin.from("user_roles").select("role, app_code").eq("tenant_id", tenantId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    const ok2 = (data ?? []).some((r) => {
      const role = r.role;
      const appCode = r.app_code;
      if (appCode === null) return role === "owner" || role === "super_admin";
      return appCode === deps.appCode && role === "admin";
    });
    if (!ok2) throw new Error("Forbidden");
    return;
  }
  const { data: ok } = await supabase.rpc("has_any_role", {
    _tenant: tenantId,
    _user: userId,
    _roles: ["owner", "super_admin"]
  });
  if (!ok) throw new Error("Forbidden");
}
function createGetSuiteHome(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((d) => TenantInput2.parse(d)).handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = data.tenantId;
    const { data: member } = await supabase.from("tenant_users").select("tenant_id").eq("tenant_id", tenantId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (!member) throw new Error("Forbidden");
    const [
      { data: settings },
      { data: approvals },
      { data: prs },
      { data: bills },
      { data: notifs },
      { data: activity }
    ] = await Promise.all([
      supabase.from("settings_kv").select("key, value").eq("tenant_id", tenantId).in("key", APP_URL_KEYS),
      supabase.from("approvals").select("id, doc_kind, doc_id, sequence_no, created_at, source_app, meta, link_path").eq("tenant_id", tenantId).eq("assigned_to", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(10),
      supabase.from("payment_requests").select("id, request_no, status, amount_usd, created_at, due_date").eq("tenant_id", tenantId).eq("submitted_by", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("bills").select("id, bill_no, status, amount_usd, created_at, due_date").eq("tenant_id", tenantId).eq("created_by", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("notifications").select("id, kind, title, body, link_path, read_at, created_at, app_code").eq("tenant_id", tenantId).eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("audit_logs").select("id, action, record_type, record_id, user_name, created_at, app_code").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10)
    ]);
    const prIds = (approvals ?? []).filter((a) => a.doc_kind === "payment_request").map((a) => a.doc_id);
    const billIds = (approvals ?? []).filter((a) => a.doc_kind === "bill").map((a) => a.doc_id);
    const expIds = (approvals ?? []).filter((a) => a.doc_kind === "expense").map((a) => a.doc_id);
    const invIds = (approvals ?? []).filter((a) => a.doc_kind === "invoice").map((a) => a.doc_id);
    const [prTitles, billTitles, expTitles, invTitles] = await Promise.all([
      prIds.length ? supabase.from("payment_requests").select("id, request_no, amount_usd, due_date").in("id", prIds) : Promise.resolve({ data: [] }),
      billIds.length ? supabase.from("bills").select("id, bill_no, amount_usd, due_date").in("id", billIds) : Promise.resolve({ data: [] }),
      expIds.length ? supabase.from("expenses").select("id, expense_no, amount_usd").in("id", expIds) : Promise.resolve({ data: [] }),
      invIds.length ? supabase.from("invoices").select("id, invoice_no, amount_usd, due_date").in("id", invIds) : Promise.resolve({ data: [] })
    ]);
    const titleFor = (kind, id) => {
      const m = kind === "payment_request" ? (prTitles.data ?? []).find((r) => r.id === id) : kind === "bill" ? (billTitles.data ?? []).find((r) => r.id === id) : kind === "expense" ? (expTitles.data ?? []).find((r) => r.id === id) : kind === "invoice" ? (invTitles.data ?? []).find((r) => r.id === id) : null;
      if (!m) return { title: null, amount_usd: null, due_date: null };
      return {
        title: (m.request_no || m.bill_no || m.expense_no || m.invoice_no) ?? null,
        amount_usd: m.amount_usd ?? null,
        due_date: m.due_date ?? null
      };
    };
    const appUrls = {};
    for (const row of settings ?? []) {
      const code = row.key.replace(/^app_url\./, "");
      const v = typeof row.value === "string" ? row.value : row.value?.url ?? "";
      if (v) appUrls[code] = v;
    }
    const { data: activeApps } = await supabase.from("tenant_apps").select("app_code").eq("tenant_id", tenantId).eq("status", "active");
    const subscribed = new Set((activeApps ?? []).map((r) => r.app_code));
    const inferApp = (a) => {
      if (a.source_app) return a.source_app;
      const k = String(a.doc_kind ?? "");
      return k.includes(".") ? k.split(".")[0] : "joabooks";
    };
    return {
      appUrls,
      myApprovals: (approvals ?? []).filter((a) => subscribed.size === 0 || subscribed.has(inferApp(a))).map((a) => {
        const meta = a.meta && typeof a.meta === "object" ? a.meta : {};
        const t = titleFor(a.doc_kind, a.doc_id);
        const title = meta.title ?? t.title ?? String(a.doc_kind ?? "").replace(/^[a-z]+\./, "").replace(/_/g, " ") ?? null;
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
          link_path: a.link_path ?? null
        };
      }),
      requestedByMe: [
        ...(prs ?? []).map((r) => ({
          id: r.id,
          kind: "payment_request",
          no: r.request_no,
          status: r.status,
          amount_usd: r.amount_usd,
          created_at: r.created_at
        })),
        ...(bills ?? []).map((r) => ({
          id: r.id,
          kind: "bill",
          no: r.bill_no,
          status: r.status,
          amount_usd: r.amount_usd,
          created_at: r.created_at
        }))
      ].sort((a, b) => a.created_at < b.created_at ? 1 : -1).slice(0, 8),
      notifications: notifs ?? [],
      recentActivity: activity ?? []
    };
  });
}
var SetAppUrlInput = z.object({
  tenantId: z.string().uuid(),
  appCode: z.enum(["joabooks", "joaapproval", "joacrm", "joaoffice", "joasop"]),
  url: z.string().max(2048).refine(
    (u) => u === "" || /^https?:\/\//i.test(u),
    { message: "URL must start with http:// or https://" }
  ).or(z.literal(""))
});
function createSetAppUrl(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((d) => SetAppUrlInput.parse(d)).handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnerOrAdmin(deps, supabase, data.tenantId, userId);
    const key = `app_url.${data.appCode}`;
    if (!data.url) {
      const { error: error2 } = await supabase.from("settings_kv").delete().eq("tenant_id", data.tenantId).eq("key", key);
      if (error2) throw error2;
      return { ok: true };
    }
    const { error } = await supabase.from("settings_kv").upsert(
      { tenant_id: data.tenantId, key, value: data.url, updated_at: (/* @__PURE__ */ new Date()).toISOString() },
      { onConflict: "tenant_id,key" }
    );
    if (error) throw error;
    return { ok: true };
  });
}

// src/server/org-scope.functions.ts
async function resolveScopedTenantIds(supabase, userId, tenantIds) {
  if (tenantIds.length === 0) throw new Error("At least one organization is required");
  const { data, error } = await supabase.from("tenant_users").select("tenant_id").eq("user_id", userId).eq("status", "active").in("tenant_id", tenantIds);
  if (error) throw new Error(error.message);
  const active = new Set((data ?? []).map((r) => r.tenant_id));
  const verified = tenantIds.filter((id) => active.has(id));
  if (verified.length !== tenantIds.length) {
    throw new Error("Forbidden: one or more organizations are not an active membership");
  }
  return verified;
}
function createListNotifications(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      unread_only: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(30)
    }).parse(i)
  ).handler(async ({ data, context }) => {
    let q = context.supabase.from("notifications").select("id, kind, title, body, link_path, read_at, created_at, app_code").eq("tenant_id", data.tenant_id).eq("user_id", context.userId).order("created_at", { ascending: false }).limit(data.limit);
    if (!deps.crossApp) q = q.or(`app_code.eq.${deps.appCode},app_code.is.null`);
    if (data.unread_only) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let countQ = context.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("tenant_id", data.tenant_id).eq("user_id", context.userId).is("read_at", null);
    if (!deps.crossApp) countQ = countQ.or(`app_code.eq.${deps.appCode},app_code.is.null`);
    const { count } = await countQ;
    return { rows: rows ?? [], unread_count: count ?? 0 };
  });
}
function createMarkNotificationRead(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    const { error } = await deps.supabaseAdmin.from("notifications").update({ read_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createMarkAllNotificationsRead(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    const { error } = await deps.supabaseAdmin.from("notifications").update({ read_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("tenant_id", data.tenant_id).eq("user_id", context.userId).is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function resolveAppBaseUrl(deps) {
  return (process.env.APP_BASE_URL || deps.appBaseUrl).replace(/\/$/, "");
}
var APP_ROLES = [
  "owner",
  "super_admin",
  "admin",
  "billing_admin",
  "finance_ap",
  "finance_ar",
  "finance_manager",
  "accountant",
  "approver",
  "vendor",
  "customer",
  "hr_manager",
  "manager",
  "employee",
  "sop_admin",
  "sop_author",
  "sop_reviewer",
  "sop_operator"
];
var AppRole = z.enum(APP_ROLES);
var Portal = z.enum(["internal", "vendor", "approver", "customer"]);
async function getCallerManageableTenantIds(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("tenant_id, role").eq("user_id", userId).in("role", ["owner", "super_admin"]);
  if (error) throw new Error(error.message);
  const ids = /* @__PURE__ */ new Set();
  (data ?? []).forEach((r) => ids.add(r.tenant_id));
  return Array.from(ids);
}
async function assertCallerManagesTenant(supabaseAdmin, tenantId, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.some((r) => r === "owner" || r === "super_admin")) {
    throw new Error("Forbidden: owner or super_admin required");
  }
}
async function callerIsOwner(supabaseAdmin, tenantId, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("tenant_id", tenantId).eq("user_id", userId).eq("role", "owner").limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}
async function getCallerOwnerTenantIds(supabaseAdmin, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("tenant_id").eq("user_id", userId).eq("role", "owner");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r) => r.tenant_id)));
}
async function findOrInviteUserForAccount(deps, email, displayName, primaryTenantId) {
  const { data: existing, error } = await deps.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  if (error) throw new Error(error.message);
  const match = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    return { user: match, created: false, actionLink: null };
  }
  const base = resolveAppBaseUrl(deps);
  const redirectTo = primaryTenantId ? `${base}/reset-password?tenant=${encodeURIComponent(primaryTenantId)}` : `${base}/reset-password`;
  const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { display_name: displayName ?? null, primary_tenant_id: primaryTenantId ?? null }
    }
  });
  if (linkErr) throw new Error(`Failed to generate invite link: ${linkErr.message}`);
  if (!link?.user) throw new Error("Invite did not return a user");
  return {
    user: link.user,
    created: true,
    actionLink: link.properties?.action_link ?? null
  };
}
async function sendMultiOrgInviteEmail(deps, opts) {
  const safe = (s) => String(s).replace(/[<>&]/g, "");
  const primary = opts.primaryTenantName ?? opts.tenantNames[0] ?? "your workspace";
  const others = opts.tenantNames.filter((n) => n !== primary);
  const orgListHtml = [
    `<li><strong>${safe(primary)}</strong> <span style="color:#677084">(primary)</span></li>`,
    ...others.map((n) => `<li>${safe(n)}</li>`)
  ].join("");
  const subject = opts.created ? `You've been invited to ${safe(primary)} on JoaSuite` : `You've been added to ${safe(primary)} on JoaSuite`;
  const link = opts.actionLink ?? "";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
      <h2 style="margin:0 0 12px 0">JoaSuite</h2>
      <p>Hi${opts.display_name ? " " + safe(opts.display_name) : ""},</p>
      <p>You have been ${opts.created ? "invited" : "added"} to <strong>${safe(primary)}</strong> on JoaSuite${others.length > 0 ? `, and also to ${others.length} other workspace${others.length > 1 ? "s" : ""}` : ""}.</p>
      <ul>${orgListHtml}</ul>
      ${link ? `<p style="margin:24px 0"><a href="${link}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Set password &amp; sign in to ${safe(primary)}</a></p>
             <p style="color:#677084;font-size:13px">This link will let you create your password and sign you in to <strong>${safe(primary)}</strong>. It expires soon, so please use it right away.</p>` : ``}
      <p style="color:#677084;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return deps.sendEmail({ to: opts.email, subject, html });
}
var AppAssignment = z.object({
  app_code: z.string().min(1).max(64),
  roles: z.array(AppRole).min(1)
});
async function assertAppsSubscribed(supabaseAdmin, tenantId, appCodes) {
  if (appCodes.length === 0) return;
  const { data, error } = await supabaseAdmin.from("tenant_apps").select("app_code").eq("tenant_id", tenantId).eq("status", "active").in("app_code", appCodes);
  if (error) throw new Error(error.message);
  const active = new Set((data ?? []).map((r) => r.app_code));
  const missing = appCodes.filter((c) => !active.has(c));
  if (missing.length > 0) {
    throw new Error(`Apps not subscribed for this workspace: ${missing.join(", ")}`);
  }
}
async function assertCallerCanManageUser(supabaseAdmin, callerId, targetUserId) {
  const tenantIds = await getCallerManageableTenantIds(supabaseAdmin, callerId);
  if (tenantIds.length === 0) throw new Error("Forbidden: no manageable workspaces");
  const { data, error } = await supabaseAdmin.from("tenant_users").select("tenant_id").eq("user_id", targetUserId).in("tenant_id", tenantIds);
  if (error) throw new Error(error.message);
  const shared = (data ?? []).map((r) => r.tenant_id);
  if (shared.length === 0) throw new Error("Forbidden: target user is not in any of your workspaces");
  return shared;
}
async function getTargetEmail(supabaseAdmin, targetUserId) {
  const { data, error } = await supabaseAdmin.from("tenant_users").select("email, display_name").eq("user_id", targetUserId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.email) throw new Error("User has no email on file");
  return { email: data.email, display_name: data.display_name ?? null };
}
function createListManageableTenants(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).handler(async ({ context }) => {
    const userId = context.userId;
    const ids = await getCallerManageableTenantIds(deps.supabaseAdmin, userId);
    if (ids.length === 0) return [];
    const { data, error } = await deps.supabaseAdmin.from("tenants").select("id, name, slug, plan").in("id", ids).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}
function createListManageableUsers(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).handler(async ({ context }) => {
    const userId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    const tenantIds = await getCallerManageableTenantIds(supabaseAdmin, userId);
    if (tenantIds.length === 0) return { tenants: [], users: [] };
    const [{ data: tenants }, { data: members }, { data: roleRows }, { data: appRows }] = await Promise.all([
      supabaseAdmin.from("tenants").select("id, name, slug").in("id", tenantIds).order("name"),
      supabaseAdmin.from("tenant_users").select("tenant_id, user_id, portal, status, display_name, email, position, joined_at, created_at").in("tenant_id", tenantIds),
      supabaseAdmin.from("user_roles").select("tenant_id, user_id, role, app_code").in("tenant_id", tenantIds),
      supabaseAdmin.from("tenant_apps").select("tenant_id, app_code, status, plan").in("tenant_id", tenantIds).eq("status", "active")
    ]);
    const rolesByCell = /* @__PURE__ */ new Map();
    (roleRows ?? []).forEach((r) => {
      const k = `${r.tenant_id}|${r.user_id}|${r.app_code ?? deps.appCode}`;
      const arr = rolesByCell.get(k) ?? [];
      arr.push(r.role);
      rolesByCell.set(k, arr);
    });
    const appsByTenant = /* @__PURE__ */ new Map();
    const planByTenantApp = /* @__PURE__ */ new Map();
    (appRows ?? []).forEach((r) => {
      const arr = appsByTenant.get(r.tenant_id) ?? [];
      arr.push(r.app_code);
      appsByTenant.set(r.tenant_id, arr);
      planByTenantApp.set(`${r.tenant_id}|${r.app_code}`, r.plan ?? null);
    });
    const lastSignInByUid = /* @__PURE__ */ new Map();
    const authCreatedByUid = /* @__PURE__ */ new Map();
    try {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        (data?.users ?? []).forEach((u) => {
          lastSignInByUid.set(u.id, u.last_sign_in_at ?? null);
          authCreatedByUid.set(u.id, u.created_at ?? null);
        });
        if (!data?.users || data.users.length < 200) break;
      }
    } catch {
    }
    const usersByUid = /* @__PURE__ */ new Map();
    (members ?? []).filter((m) => m.portal === "internal").forEach((m) => {
      const uid = m.user_id;
      const tid = m.tenant_id;
      const joined = m.joined_at ?? m.created_at ?? null;
      const pos = m.position ?? null;
      let row = usersByUid.get(uid);
      if (!row) {
        row = {
          user_id: uid,
          email: m.email ?? null,
          display_name: m.display_name ?? null,
          position: pos,
          joined_at: joined,
          last_sign_in_at: lastSignInByUid.get(uid) ?? null,
          assignments: {}
        };
        usersByUid.set(uid, row);
      } else {
        if (!row.email && m.email) row.email = m.email;
        if (!row.display_name && m.display_name) row.display_name = m.display_name;
        if (!row.position && pos) row.position = pos;
        if (joined && (!row.joined_at || joined < row.joined_at)) row.joined_at = joined;
      }
      const apps = {};
      const tenantApps = appsByTenant.get(tid) ?? [];
      const codes = new Set(tenantApps);
      (roleRows ?? []).filter((r) => r.tenant_id === tid && r.user_id === uid).forEach((r) => codes.add(r.app_code ?? deps.appCode));
      codes.forEach((code) => {
        apps[code] = { roles: rolesByCell.get(`${tid}|${uid}|${code}`) ?? [] };
      });
      row.assignments[tid] = {
        tenant_id: tid,
        portal: m.portal ?? "internal",
        status: m.status ?? "active",
        joined_at: joined,
        position: pos,
        apps
      };
    });
    usersByUid.forEach((row) => {
      if (!row.joined_at) row.joined_at = authCreatedByUid.get(row.user_id) ?? null;
    });
    const users = Array.from(usersByUid.values()).sort(
      (a, b) => (a.email ?? "").localeCompare(b.email ?? "")
    );
    const tenantsWithApps = (tenants ?? []).map((t) => {
      const codes = appsByTenant.get(t.id) ?? [];
      return {
        ...t,
        app_codes: codes,
        app_plans: Object.fromEntries(
          codes.map((c) => [c, planByTenantApp.get(`${t.id}|${c}`) ?? null])
        )
      };
    });
    return {
      tenants: tenantsWithApps,
      users,
      caller_owner_tenant_ids: await getCallerOwnerTenantIds(supabaseAdmin, userId)
    };
  });
}
function createInviteUserToWorkspaces(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      email: z.string().email(),
      display_name: z.string().min(1).max(120),
      position: z.string().max(120).optional(),
      primary_tenant_id: z.string().uuid().optional(),
      assignments: z.array(
        z.object({
          tenant_id: z.string().uuid(),
          portal: Portal.default("internal"),
          apps: z.array(AppAssignment).default([])
        })
      ).min(1)
    }).parse(i)
  ).handler(async ({ data, context }) => {
    const callerId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    for (const a of data.assignments) {
      await assertCallerManagesTenant(supabaseAdmin, a.tenant_id, callerId);
      const wantsOwner = a.apps.some((ap) => ap.roles.includes("owner"));
      if (wantsOwner) {
        const isOwner = await callerIsOwner(supabaseAdmin, a.tenant_id, callerId);
        if (!isOwner) {
          throw new Error("Only an Owner can grant the Owner role to another user.");
        }
      }
      if (a.apps.length > 0) {
        await assertAppsSubscribed(
          supabaseAdmin,
          a.tenant_id,
          a.apps.map((x) => x.app_code)
        );
      }
    }
    const primaryTenantId = data.primary_tenant_id && data.assignments.some((a) => a.tenant_id === data.primary_tenant_id) ? data.primary_tenant_id : data.assignments[0].tenant_id;
    const invited = await findOrInviteUserForAccount(
      deps,
      data.email,
      data.display_name,
      primaryTenantId
    );
    const { data: tenants } = await supabaseAdmin.from("tenants").select("id, name").in(
      "id",
      data.assignments.map((a) => a.tenant_id)
    );
    const nameById = /* @__PURE__ */ new Map();
    (tenants ?? []).forEach((t) => nameById.set(t.id, t.name ?? ""));
    const addedTenants = [];
    for (const a of data.assignments) {
      const { error: muErr } = await supabaseAdmin.from("tenant_users").upsert(
        {
          tenant_id: a.tenant_id,
          user_id: invited.user.id,
          portal: a.portal,
          status: "active",
          display_name: data.display_name,
          email: invited.user.email ?? data.email,
          position: data.position ?? null,
          invited_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "tenant_id,user_id" }
      );
      if (muErr) throw new Error(muErr.message);
      const rows = a.apps.flatMap(
        (ap) => ap.roles.map((r) => ({
          tenant_id: a.tenant_id,
          user_id: invited.user.id,
          role: r,
          app_code: ap.app_code
        }))
      );
      if (rows.length > 0) {
        const { error: rErr } = await supabaseAdmin.from("user_roles").upsert(rows, { onConflict: "tenant_id,user_id,role,app_code" });
        if (rErr) throw new Error(rErr.message);
      }
      addedTenants.push(nameById.get(a.tenant_id) ?? "");
    }
    const primaryName = nameById.get(primaryTenantId) ?? addedTenants[0] ?? null;
    let emailResult = null;
    if (invited.created) {
      emailResult = await sendMultiOrgInviteEmail(deps, {
        email: data.email,
        display_name: data.display_name,
        created: invited.created,
        actionLink: invited.actionLink,
        tenantNames: addedTenants.filter(Boolean),
        primaryTenantName: primaryName
      });
    }
    return {
      user_id: invited.user.id,
      created: invited.created,
      tenants_added: addedTenants.length,
      primary_tenant_id: primaryTenantId,
      email: emailResult
    };
  });
}
function createSetUserAppRoles(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      app_code: z.string().min(1).max(64),
      roles: z.array(AppRole).default([])
    }).parse(i)
  ).handler(async ({ data, context }) => {
    const callerId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    await assertCallerManagesTenant(supabaseAdmin, data.tenant_id, callerId);
    if (data.roles.includes("owner")) {
      const isOwner = await callerIsOwner(supabaseAdmin, data.tenant_id, callerId);
      if (!isOwner && data.user_id !== callerId) {
        throw new Error("Only an Owner can grant the Owner role to another user.");
      }
    }
    if (data.roles.length > 0) {
      await assertAppsSubscribed(supabaseAdmin, data.tenant_id, [data.app_code]);
    }
    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("tenant_id", data.tenant_id).eq("user_id", data.user_id).eq("app_code", data.app_code);
    if (delErr) throw new Error(delErr.message);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        tenant_id: data.tenant_id,
        user_id: data.user_id,
        role: r,
        app_code: data.app_code
      }));
      const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
}
function createAccountResendInvitation(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    const callerId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    const sharedTenantIds = await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
    const { email, display_name } = await getTargetEmail(supabaseAdmin, data.user_id);
    const { data: tenants } = await supabaseAdmin.from("tenants").select("name").in("id", sharedTenantIds);
    const tenantNames = (tenants ?? []).map((t) => t.name ?? "").filter(Boolean);
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` }
    });
    if (linkErr) throw new Error(linkErr.message);
    const result = await sendMultiOrgInviteEmail(deps, {
      email,
      display_name: display_name ?? void 0,
      created: false,
      actionLink: link?.properties?.action_link ?? null,
      tenantNames
    });
    return { ok: true, email: result };
  });
}
function createAccountSendPasswordReset(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    const callerId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
    const { email, display_name } = await getTargetEmail(supabaseAdmin, data.user_id);
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` }
    });
    if (linkErr) throw new Error(linkErr.message);
    const url = link?.properties?.action_link ?? "";
    const subject = `Reset your ${deps.appName} password`;
    const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
          <h2 style="margin:0 0 12px 0">${deps.appName}</h2>
          <p>Hi${display_name ? " " + display_name : ""},</p>
          <p>A password reset was requested for your ${deps.appName} account.</p>
          <p style="margin:24px 0">
            <a href="${url}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a>
          </p>
          <p style="color:#677084;font-size:13px">If you didn't expect this, you can ignore this email.</p>
        </div>`;
    const result = await deps.sendEmail({ to: email, subject, html });
    return { ok: true, email: result };
  });
}
function createAccountUpdateUserProfile(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      user_id: z.string().uuid(),
      display_name: z.string().min(1).max(120),
      email: z.string().email().optional(),
      position: z.string().max(120).nullable().optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    const callerId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    const sharedTenantIds = await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
    const patch = { display_name: data.display_name };
    if (data.email) patch.email = data.email;
    if (data.position !== void 0) patch.position = data.position;
    const { error } = await supabaseAdmin.from("tenant_users").update(patch).eq("user_id", data.user_id).in("tenant_id", sharedTenantIds);
    if (error) throw new Error(error.message);
    if (data.email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        email: data.email
      });
      if (authErr) throw new Error(authErr.message);
    }
    return { ok: true };
  });
}
function createGetMyProfile(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).handler(async ({ context }) => {
    const userId = context.userId;
    const { data, error } = await deps.supabaseAdmin.from("profiles").select("id, default_tenant_id, timezone").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return {
      default_tenant_id: data?.default_tenant_id ?? null,
      timezone: data?.timezone ?? null
    };
  });
}
function createUpdateMyTimezone(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({ timezone: z.string().min(1).max(100).nullable() }).parse(i)
  ).handler(async ({ data, context }) => {
    const userId = context.userId;
    if (data.timezone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: data.timezone });
      } catch {
        throw new Error("Invalid timezone");
      }
    }
    const { error } = await deps.supabaseAdmin.from("profiles").upsert({ id: userId, timezone: data.timezone }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createUpdateMyDefaultTenant(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({ tenant_id: z.string().uuid().nullable() }).parse(i)
  ).handler(async ({ data, context }) => {
    const userId = context.userId;
    const supabaseAdmin = deps.supabaseAdmin;
    if (data.tenant_id) {
      const { data: m, error: mErr } = await supabaseAdmin.from("tenant_users").select("tenant_id").eq("tenant_id", data.tenant_id).eq("user_id", userId).eq("status", "active").maybeSingle();
      if (mErr) throw new Error(mErr.message);
      if (!m) throw new Error("Not a member of that workspace");
    }
    const { error } = await supabaseAdmin.from("profiles").upsert({ id: userId, default_tenant_id: data.tenant_id }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function resolveAppBaseUrl2(deps) {
  return (process.env.APP_BASE_URL || deps.appBaseUrl).replace(/\/$/, "");
}
var APP_ROLES2 = [
  "owner",
  "super_admin",
  "admin",
  "finance_ap",
  "finance_ar",
  "finance_manager",
  "accountant",
  "approver",
  "vendor",
  "customer"
];
var AppRole2 = z.enum(APP_ROLES2);
async function assertOwnerOrAdmin2(supabaseAdmin, appCode, tenantId, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role, app_code").eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ok = rows.some((r) => {
    const role = r.role;
    const rowAppCode = r.app_code;
    if (rowAppCode === null) return role === "owner" || role === "super_admin";
    return rowAppCode === appCode && role === "admin";
  });
  if (!ok) throw new Error("Forbidden: admin role required");
}
async function assertCanEditVendor(supabaseAdmin, appCode, tenantId, userId) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role, app_code").eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ok = rows.some((r) => {
    const role = r.role;
    const rowAppCode = r.app_code;
    if (rowAppCode === null) return role === "owner" || role === "super_admin";
    return rowAppCode === appCode && role === "admin";
  });
  if (!ok) throw new Error("Forbidden: vendor edit role required");
}
async function assertTenantMember(supabaseAdmin, tenantId, userId) {
  const { data, error } = await supabaseAdmin.from("tenant_users").select("id").eq("tenant_id", tenantId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a tenant member");
}
async function findOrInviteUser(deps, email, displayName) {
  const { data: existing, error: lookupErr } = await deps.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });
  if (lookupErr) throw new Error(lookupErr.message);
  const match = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    return { user: match, created: false, alreadyExisted: true, actionLink: null };
  }
  const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${resolveAppBaseUrl2(deps)}/reset-password`,
      data: { display_name: displayName ?? null }
    }
  });
  if (linkErr) throw new Error(`Failed to generate invite link: ${linkErr.message}`);
  if (!link?.user) throw new Error("Invite did not return a user");
  return {
    user: link.user,
    created: true,
    alreadyExisted: false,
    actionLink: link.properties?.action_link ?? null
  };
}
async function sendInviteEmail(deps, opts) {
  const subject = opts.created ? `You've been invited to ${opts.tenantName} on ${deps.appName}` : `You've been added to ${opts.tenantName} on ${deps.appName}`;
  const link = opts.actionLink ?? "";
  const safeName = String(opts.tenantName).replace(/[<>&]/g, "");
  const safeVendorName = opts.vendorName ? String(opts.vendorName).replace(/[<>&]/g, "") : "";
  const signInUrl = `${resolveAppBaseUrl2(deps)}/signin`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
      <h2 style="margin:0 0 12px 0">${deps.appName}</h2>
      <p>Hi${opts.display_name ? " " + opts.display_name : ""},</p>
      <p>You have been ${opts.created ? "invited" : "added"} to the <strong>${safeName}</strong> workspace on ${deps.appName}.</p>
      ${safeVendorName ? `<p>You have been invited as a contact for <strong>${safeVendorName}</strong> and can access the vendor portal to view payment requests and submit new ones.</p>` : ""}
      ${link ? `<p style="margin:24px 0"><a href="${link}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${opts.created ? "Set password &amp; sign in" : "Sign in to " + safeName}</a></p>
             <p style="color:#677084;font-size:13px">${opts.created ? "This link will let you create your password and sign in to" : "This one-time link signs you in to"} <strong>${safeName}</strong>. It expires soon, so please use it right away.</p>` : `<p style="margin:24px 0"><a href="${signInUrl}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Sign in</a></p>
             <p style="color:#677084;font-size:13px">Sign in with your existing ${deps.appName} account to access <strong>${safeName}</strong>.</p>`}
      <p style="color:#677084;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return deps.sendEmail({ to: opts.email, subject, html });
}
function createGetTenantSettings(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { data: t, error } = await deps.supabaseAdmin.from("tenants").select("id, name, slug, status, settings").eq("id", data.tenant_id).single();
    if (error) throw new Error(error.message);
    return t;
  });
}
function createUpdateTenantSettings(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      settings: z.record(z.string(), z.any()).optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const patch = {};
    if (data.name) patch.name = data.name;
    if (data.settings) patch.settings = data.settings;
    const { data: t, error } = await deps.supabaseAdmin.from("tenants").update(patch).eq("id", data.tenant_id).select("id, name, settings").single();
    if (error) throw new Error(error.message);
    return t;
  });
}
function createListTenantUsers(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { data: members, error } = await deps.supabaseAdmin.from("tenant_users").select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at").eq("tenant_id", data.tenant_id).order("created_at");
    if (error) throw new Error(error.message);
    const { data: roles } = await deps.supabaseAdmin.from("user_roles").select("user_id, role").eq("tenant_id", data.tenant_id);
    const byUser = /* @__PURE__ */ new Map();
    (roles ?? []).forEach((r) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });
    return (members ?? []).map((m) => ({ ...m, roles: byUser.get(m.user_id) ?? [] }));
  });
}
function createGetTenantUser(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { data: m, error } = await deps.supabaseAdmin.from("tenant_users").select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at").eq("tenant_id", data.tenant_id).eq("user_id", data.user_id).single();
    if (error) throw new Error(error.message);
    const { data: roles } = await deps.supabaseAdmin.from("user_roles").select("role").eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    return { ...m, roles: (roles ?? []).map((r) => r.role) };
  });
}
function createUpdateTenantUserProfile(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      display_name: z.string().min(1).max(120),
      position: z.string().max(120).optional().nullable()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("tenant_users").update({ display_name: data.display_name, position: data.position ?? null }).eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createInviteTenantUser(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      email: z.string().email(),
      display_name: z.string().min(1, "Name is required").max(120),
      position: z.string().max(120).optional(),
      portal: z.enum(["internal", "vendor", "approver", "customer"]).default("internal"),
      roles: z.array(AppRole2).default([]),
      party_id: z.string().uuid().optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    if (data.portal === "vendor") {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    } else {
      await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    }
    const invited = await findOrInviteUser(deps, data.email, data.display_name);
    const { data: tenantRow } = await deps.supabaseAdmin.from("tenants").select("name").eq("id", data.tenant_id).single();
    const tenantName = tenantRow?.name ?? "your workspace";
    const { data: existingMembership } = await deps.supabaseAdmin.from("tenant_users").select("user_id").eq("tenant_id", data.tenant_id).eq("user_id", invited.user.id).maybeSingle();
    const alreadyMember = !!existingMembership;
    const { error: muErr } = await deps.supabaseAdmin.from("tenant_users").upsert(
      {
        tenant_id: data.tenant_id,
        user_id: invited.user.id,
        portal: data.portal,
        status: "active",
        display_name: data.display_name,
        email: invited.user.email ?? data.email,
        position: data.position ?? null,
        invited_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "tenant_id,user_id" }
    );
    if (muErr) throw new Error(muErr.message);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        tenant_id: data.tenant_id,
        user_id: invited.user.id,
        role: r
      }));
      const { error: rErr } = await deps.supabaseAdmin.from("user_roles").upsert(rows, { onConflict: "tenant_id,user_id,role,app_code" });
      if (rErr) throw new Error(rErr.message);
    }
    if (data.party_id) {
      const { error: pErr } = await deps.supabaseAdmin.from("parties").update({ linked_user_id: invited.user.id }).eq("id", data.party_id).eq("tenant_id", data.tenant_id);
      if (pErr) throw new Error(pErr.message);
    }
    let actionLink = invited.actionLink;
    if (!invited.created) {
      const confirmed = !!invited.user.email_confirmed_at;
      const { data: link } = await deps.supabaseAdmin.auth.admin.generateLink({
        type: confirmed ? "magiclink" : "invite",
        email: data.email,
        options: { redirectTo: `${resolveAppBaseUrl2(deps)}/reset-password` }
      });
      actionLink = link?.properties?.action_link ?? null;
    }
    const emailResult = await sendInviteEmail(deps, {
      email: data.email,
      display_name: data.display_name,
      created: invited.created,
      actionLink,
      tenantName
    });
    return {
      user_id: invited.user.id,
      created: invited.created,
      added_existing: invited.alreadyExisted,
      already_member: alreadyMember,
      email: emailResult
    };
  });
}
function createResendInvitation(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { data: m, error } = await deps.supabaseAdmin.from("tenant_users").select("email, display_name").eq("tenant_id", data.tenant_id).eq("user_id", data.user_id).single();
    if (error) throw new Error(error.message);
    if (!m.email) throw new Error("User has no email on file");
    const { data: tenantRow } = await deps.supabaseAdmin.from("tenants").select("name").eq("id", data.tenant_id).single();
    const tenantName = tenantRow?.name ?? "your workspace";
    const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.email,
      options: { redirectTo: `${resolveAppBaseUrl2(deps)}/reset-password` }
    });
    if (linkErr) throw new Error(linkErr.message);
    const result = await sendInviteEmail(deps, {
      email: m.email,
      display_name: m.display_name ?? void 0,
      created: false,
      actionLink: link?.properties?.action_link ?? null,
      tenantName
    });
    return { ok: true, email: result };
  });
}
function createSendPasswordResetLink(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { data: m, error } = await deps.supabaseAdmin.from("tenant_users").select("email, display_name").eq("tenant_id", data.tenant_id).eq("user_id", data.user_id).single();
    if (error) throw new Error(error.message);
    if (!m.email) throw new Error("User has no email on file");
    const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.email,
      options: { redirectTo: `${resolveAppBaseUrl2(deps)}/reset-password` }
    });
    if (linkErr) throw new Error(linkErr.message);
    const url = link?.properties?.action_link ?? "";
    const subject = `Reset your ${deps.appName} password`;
    const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
          <h2 style="margin:0 0 12px 0">${deps.appName}</h2>
          <p>Hi${m.display_name ? " " + m.display_name : ""},</p>
          <p>A password reset was requested for your ${deps.appName} account.</p>
          <p style="margin:24px 0">
            <a href="${url}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a>
          </p>
          <p style="color:#677084;font-size:13px">If you didn't expect this, you can ignore this email.</p>
        </div>`;
    const result = await deps.sendEmail({ to: m.email, subject, html });
    return { ok: true, email: result };
  });
}
function createUpdateTenantUserRoles(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      roles: z.array(AppRole2),
      app_code: z.string().min(1).max(64).optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const appCode = data.app_code ?? deps.appCode;
    const { error: delErr } = await deps.supabaseAdmin.from("user_roles").delete().eq("tenant_id", data.tenant_id).eq("user_id", data.user_id).eq("app_code", appCode);
    if (delErr) throw new Error(delErr.message);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        tenant_id: data.tenant_id,
        user_id: data.user_id,
        role: r,
        app_code: appCode
      }));
      const { error } = await deps.supabaseAdmin.from("user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
}
function createSetTenantUserStatus(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      status: z.enum(["active", "invited", "suspended"])
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertOwnerOrAdmin2(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("tenant_users").update({ status: data.status }).eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createRemoveTenantUser(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    const callerId = context.userId;
    if (data.user_id === callerId) {
      throw new Error("You cannot remove yourself. Use 'Leave organization' instead.");
    }
    const { data: callerRoles, error: crErr } = await deps.supabaseAdmin.from("user_roles").select("role").eq("tenant_id", data.tenant_id).eq("user_id", callerId);
    if (crErr) throw new Error(crErr.message);
    const callerSet = new Set((callerRoles ?? []).map((r) => r.role));
    if (!callerSet.has("owner") && !callerSet.has("super_admin")) {
      throw new Error("Forbidden: owner or super_admin required");
    }
    const { data: targetRoles, error: trErr } = await deps.supabaseAdmin.from("user_roles").select("role").eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    if (trErr) throw new Error(trErr.message);
    if ((targetRoles ?? []).some((r) => r.role === "owner")) {
      throw new Error("Cannot remove an owner. Transfer ownership first.");
    }
    const { error: rolesErr } = await deps.supabaseAdmin.from("user_roles").delete().eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    if (rolesErr) throw new Error(rolesErr.message);
    const { error: memErr } = await deps.supabaseAdmin.from("tenant_users").delete().eq("tenant_id", data.tenant_id).eq("user_id", data.user_id);
    if (memErr) throw new Error(memErr.message);
    return { ok: true };
  });
}
function createListParties(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      kind: z.enum(["all", "vendor", "customer"]).default("all")
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    let q = deps.supabaseAdmin.from("parties").select("*").eq("tenant_id", data.tenant_id).order("name_en");
    if (data.kind === "vendor") q = q.eq("is_vendor", true);
    if (data.kind === "customer") q = q.eq("is_customer", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const linkedIds = Array.from(
      new Set(list.map((p) => p.linked_user_id).filter((x) => !!x))
    );
    const signedInMap = /* @__PURE__ */ new Map();
    if (linkedIds.length > 0) {
      const { data: usersPage } = await deps.supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1e3
      });
      for (const u of usersPage?.users ?? []) {
        if (linkedIds.includes(u.id)) {
          signedInMap.set(u.id, !!u.last_sign_in_at);
        }
      }
    }
    return list.map((p) => ({
      ...p,
      linked_signed_in: p.linked_user_id ? signedInMap.get(p.linked_user_id) ?? false : false
    }));
  });
}
function createUpsertParty(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      name_en: z.string().min(1).max(200),
      nick_name: z.string().max(200).optional().nullable(),
      payee_type: z.enum(["business", "individual"]).default("business"),
      is_vendor: z.boolean().default(true),
      is_customer: z.boolean().default(false),
      is_payee: z.boolean().default(true),
      is_payer: z.boolean().default(false),
      legal_address: z.string().max(500).optional().nullable(),
      address_line1: z.string().max(200).optional().nullable(),
      address_line2: z.string().max(200).optional().nullable(),
      city: z.string().max(120).optional().nullable(),
      state: z.string().max(120).optional().nullable(),
      postal_code: z.string().max(40).optional().nullable(),
      country: z.string().max(120).optional().nullable(),
      contact_name: z.string().max(200).optional().nullable(),
      contact_email: z.string().email().optional().nullable().or(z.literal("")),
      contact_phone: z.string().max(60).optional().nullable(),
      tag: z.string().max(80).optional().nullable(),
      active: z.boolean().default(true),
      tax_id: z.string().max(60).optional().nullable(),
      tax_form_type: z.string().max(40).optional().nullable(),
      is_1099_vendor: z.boolean().optional(),
      w9_attachment_id: z.string().uuid().optional().nullable(),
      default_category_id: z.string().uuid().optional().nullable(),
      default_payment_method: z.string().max(40).optional().nullable(),
      default_currency: z.string().max(10).optional().nullable(),
      website: z.string().max(300).optional().nullable(),
      internal_notes: z.string().max(2e3).optional().nullable()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { id, ...rest } = data;
    const row = {
      ...rest,
      contact_email: rest.contact_email === "" ? null : rest.contact_email
    };
    if (id) {
      const { error: error2 } = await deps.supabaseAdmin.from("parties").update(row).eq("id", id);
      if (error2) throw new Error(error2.message);
      return { id };
    }
    const { data: ins, error } = await deps.supabaseAdmin.from("parties").insert({ ...row, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });
}
function createDeleteParty(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("parties").delete().eq("id", data.party_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createGetParty(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { data: row, error } = await deps.supabaseAdmin.from("parties").select("*").eq("tenant_id", data.tenant_id).eq("id", data.party_id).single();
    if (error) throw new Error(error.message);
    const [{ data: banks }, { data: contacts }] = await Promise.all([
      deps.supabaseAdmin.from("party_bank_accounts").select("*").eq("party_id", data.party_id).order("archived_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: true }),
      deps.supabaseAdmin.from("party_contacts").select("*").eq("party_id", data.party_id).order("is_primary", { ascending: false }).order("created_at", { ascending: true })
    ]);
    const allBanks = banks ?? [];
    const active = allBanks.filter((b) => !b.archived_at);
    const history = allBanks.filter((b) => !!b.archived_at);
    return {
      party: row,
      bank_accounts: active,
      bank_accounts_history: history,
      contacts: contacts ?? []
    };
  });
}
function createListPartyContacts(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { data: rows, error } = await deps.supabaseAdmin.from("party_contacts").select("*").eq("tenant_id", data.tenant_id).eq("party_id", data.party_id).order("is_primary", { ascending: false }).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
}
function createUpsertPartyContact(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(200),
      email: z.string().email().optional().nullable().or(z.literal("")),
      phone: z.string().max(60).optional().nullable(),
      role_note: z.string().max(300).optional().nullable(),
      is_primary: z.boolean().optional(),
      active: z.boolean().optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const row = {
      tenant_id: data.tenant_id,
      party_id: data.party_id,
      name: data.name,
      email: data.email === "" ? null : data.email ?? null,
      phone: data.phone ?? null,
      role_note: data.role_note ?? null,
      is_primary: data.is_primary ?? false,
      active: data.active ?? true
    };
    if (data.id) {
      const { error: error2 } = await deps.supabaseAdmin.from("party_contacts").update(row).eq("id", data.id).eq("tenant_id", data.tenant_id);
      if (error2) throw new Error(error2.message);
      return { id: data.id };
    }
    const { data: ins, error } = await deps.supabaseAdmin.from("party_contacts").insert({ ...row, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });
}
function createDeletePartyContact(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("party_contacts").delete().eq("id", data.contact_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createInvitePartyContact(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { data: c, error: ce } = await deps.supabaseAdmin.from("party_contacts").select("id, name, email, party_id, tenant_id").eq("id", data.contact_id).eq("tenant_id", data.tenant_id).single();
    if (ce) throw new Error(ce.message);
    if (!c.email) throw new Error("Contact has no email");
    const invited = await findOrInviteUser(deps, c.email, c.name);
    const { data: tenantRow } = await deps.supabaseAdmin.from("tenants").select("name").eq("id", data.tenant_id).single();
    const tenantName = tenantRow?.name ?? "your workspace";
    const { data: partyRow } = await deps.supabaseAdmin.from("parties").select("name_en").eq("id", c.party_id).single();
    const vendorName = partyRow?.name_en ?? "";
    await deps.supabaseAdmin.from("tenant_users").upsert(
      {
        tenant_id: data.tenant_id,
        user_id: invited.user.id,
        portal: "vendor",
        status: "active",
        display_name: c.name,
        email: invited.user.email ?? c.email,
        invited_at: (/* @__PURE__ */ new Date()).toISOString()
      },
      { onConflict: "tenant_id,user_id" }
    );
    await deps.supabaseAdmin.from("user_roles").upsert(
      { tenant_id: data.tenant_id, user_id: invited.user.id, role: "vendor" },
      { onConflict: "tenant_id,user_id,role,app_code" }
    );
    await deps.supabaseAdmin.from("party_contacts").update({ linked_user_id: invited.user.id, invited_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", c.id);
    const emailResult = await sendInviteEmail(deps, {
      email: c.email,
      display_name: c.name,
      created: invited.created,
      actionLink: invited.actionLink,
      tenantName,
      vendorName
    });
    return { ok: true, user_id: invited.user.id, email: emailResult };
  });
}
function createRevokePartyContact(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("party_contacts").update({ linked_user_id: null, invited_at: null }).eq("id", data.contact_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createListMyAccessibleVendors(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i)).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const [{ data: direct, error: e1 }, { data: viaContacts, error: e2 }] = await Promise.all([
      deps.supabaseAdmin.from("parties").select("id").eq("tenant_id", data.tenant_id).eq("linked_user_id", context.userId).eq("active", true),
      deps.supabaseAdmin.from("party_contacts").select("party_id").eq("tenant_id", data.tenant_id).eq("linked_user_id", context.userId).eq("active", true)
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    const ids = /* @__PURE__ */ new Set();
    (direct ?? []).forEach((r) => ids.add(r.id));
    (viaContacts ?? []).forEach((r) => r.party_id && ids.add(r.party_id));
    if (ids.size === 0) return [];
    const { data: parties, error } = await deps.supabaseAdmin.from("parties").select("id, name_en, nick_name").in("id", Array.from(ids)).eq("active", true).order("name_en");
    if (error) throw new Error(error.message);
    return parties ?? [];
  });
}
function createListMyVendorTenants(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).handler(async ({ context }) => {
    const userId = context.userId;
    const [{ data: direct }, { data: viaContacts }] = await Promise.all([
      deps.supabaseAdmin.from("parties").select("tenant_id").eq("linked_user_id", userId).eq("active", true),
      deps.supabaseAdmin.from("party_contacts").select("tenant_id").eq("linked_user_id", userId).eq("active", true)
    ]);
    const ids = /* @__PURE__ */ new Set();
    (direct ?? []).forEach((r) => r.tenant_id && ids.add(r.tenant_id));
    (viaContacts ?? []).forEach((r) => r.tenant_id && ids.add(r.tenant_id));
    return Array.from(ids);
  });
}
var BankAccountInput = z.object({
  id: z.string().uuid().optional().nullable(),
  bank_name: z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
  routing_number: z.string().nullable().optional(),
  swift: z.string().nullable().optional(),
  bank_address: z.string().nullable().optional(),
  bank_phone: z.string().nullable().optional(),
  bank_addr_line1: z.string().nullable().optional(),
  bank_addr_line2: z.string().nullable().optional(),
  bank_addr_city: z.string().nullable().optional(),
  bank_addr_state: z.string().nullable().optional(),
  bank_addr_zip: z.string().nullable().optional()
});
function createUpsertPartyBankAccount(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      bank: BankAccountInput
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const last4 = data.bank.account_number ? data.bank.account_number.slice(-4) : null;
    const patch = {
      bank_name: data.bank.bank_name ?? null,
      account_number: data.bank.account_number ?? null,
      account_last4: last4,
      routing_number: data.bank.routing_number ?? null,
      swift: data.bank.swift ?? null,
      bank_address: data.bank.bank_address ?? null,
      bank_phone: data.bank.bank_phone ?? null,
      bank_addr_line1: data.bank.bank_addr_line1 ?? null,
      bank_addr_line2: data.bank.bank_addr_line2 ?? null,
      bank_addr_city: data.bank.bank_addr_city ?? null,
      bank_addr_state: data.bank.bank_addr_state ?? null,
      bank_addr_zip: data.bank.bank_addr_zip ?? null
    };
    if (data.bank.id) {
      const { count: refCount } = await deps.supabaseAdmin.from("payment_requests").select("id", { head: true, count: "exact" }).eq("tenant_id", data.tenant_id).eq("party_bank_account_id", data.bank.id);
      if ((refCount ?? 0) > 0) {
        const { data: newRow, error: insErr } = await deps.supabaseAdmin.from("party_bank_accounts").insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch }).select("id").single();
        if (insErr) throw new Error(insErr.message);
        const { error: archErr } = await deps.supabaseAdmin.from("party_bank_accounts").update({
          archived_at: (/* @__PURE__ */ new Date()).toISOString(),
          archived_by: context.userId,
          archive_reason: "replaced",
          replaced_by_id: newRow.id
        }).eq("id", data.bank.id).eq("tenant_id", data.tenant_id);
        if (archErr) throw new Error(archErr.message);
        return { id: newRow.id, archived_previous: true };
      }
      const { error: error2 } = await deps.supabaseAdmin.from("party_bank_accounts").update(patch).eq("id", data.bank.id).eq("tenant_id", data.tenant_id);
      if (error2) throw new Error(error2.message);
      return { id: data.bank.id, archived_previous: false };
    }
    const { data: row, error } = await deps.supabaseAdmin.from("party_bank_accounts").insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id, archived_previous: false };
  });
}
function createDeletePartyBankAccount(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      bank_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { count: refCount } = await deps.supabaseAdmin.from("payment_requests").select("id", { head: true, count: "exact" }).eq("tenant_id", data.tenant_id).eq("party_bank_account_id", data.bank_id);
    if ((refCount ?? 0) > 0) {
      const { error: error2 } = await deps.supabaseAdmin.from("party_bank_accounts").update({
        archived_at: (/* @__PURE__ */ new Date()).toISOString(),
        archived_by: context.userId,
        archive_reason: "deleted"
      }).eq("id", data.bank_id).eq("tenant_id", data.tenant_id);
      if (error2) throw new Error(error2.message);
      return { ok: true, archived: true };
    }
    const { error } = await deps.supabaseAdmin.from("party_bank_accounts").delete().eq("id", data.bank_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true, archived: false };
  });
}
function createArchiveParty(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      reason: z.string().trim().max(500).optional()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("parties").update({
      archived_at: (/* @__PURE__ */ new Date()).toISOString(),
      archived_by: context.userId,
      archive_reason: data.reason ?? null
    }).eq("id", data.party_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createUnarchiveParty(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
    const { error } = await deps.supabaseAdmin.from("parties").update({
      archived_at: null,
      archived_by: null,
      archive_reason: null
    }).eq("id", data.party_id).eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}
function createCleanupPartyContacts(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    const { data: rows, error } = await deps.supabaseAdmin.from("party_contacts").select("id, email, is_primary, linked_user_id, created_at, active").eq("tenant_id", data.tenant_id).eq("party_id", data.party_id);
    if (error) throw new Error(error.message);
    const groups = /* @__PURE__ */ new Map();
    for (const c of rows ?? []) {
      const key = (c.email ?? "").trim().toLowerCase();
      if (!key) continue;
      const arr = groups.get(key) ?? [];
      arr.push(c);
      groups.set(key, arr);
    }
    let removed = 0;
    for (const [, list] of groups) {
      if (list.length < 2) continue;
      list.sort((a, b) => {
        const score = (r) => (r.linked_user_id ? 0 : 1) * 10 + (r.is_primary ? 0 : 1) * 5 + (r.active ? 0 : 1);
        const s = score(a) - score(b);
        if (s !== 0) return s;
        return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      });
      const drop = list.slice(1).map((r) => r.id);
      removed += drop.length;
      await deps.supabaseAdmin.from("party_contacts").delete().in("id", drop).eq("tenant_id", data.tenant_id);
    }
    if (removed > 0) {
      await deps.supabaseAdmin.from("audit_logs").insert({
        tenant_id: data.tenant_id,
        record_type: "parties",
        record_id: data.party_id,
        action: "contacts_deduped",
        user_id: context.userId,
        new_value: { removed }
      });
    }
    return { ok: true, removed };
  });
}
function createMergeParties(deps) {
  return createServerFn({ method: "POST" }).middleware([deps.requireSupabaseAuth]).inputValidator(
    (i) => z.object({
      tenant_id: z.string().uuid(),
      source_party_id: z.string().uuid(),
      target_party_id: z.string().uuid()
    }).parse(i)
  ).handler(async ({ data, context }) => {
    await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
    if (data.source_party_id === data.target_party_id) {
      throw new Error("Source and target must be different");
    }
    const { data: parties, error: pErr } = await deps.supabaseAdmin.from("parties").select("id, name_en").eq("tenant_id", data.tenant_id).in("id", [data.source_party_id, data.target_party_id]);
    if (pErr) throw new Error(pErr.message);
    if ((parties ?? []).length !== 2) throw new Error("Both parties must exist in this tenant");
    const source = parties.find((p) => p.id === data.source_party_id);
    const target = parties.find((p) => p.id === data.target_party_id);
    const counts = {};
    for (const { table: tbl, column } of deps.partyDocRefTables) {
      const { error, count } = await deps.supabaseAdmin.from(tbl).update({ [column]: data.target_party_id }, { count: "exact" }).eq("tenant_id", data.tenant_id).eq(column, data.source_party_id);
      if (error) throw new Error(`${tbl}: ${error.message}`);
      counts[tbl] = count ?? 0;
    }
    for (const { table: tbl, column } of deps.partyChildTables) {
      const { error, count } = await deps.supabaseAdmin.from(tbl).update({ [column]: data.target_party_id }, { count: "exact" }).eq("tenant_id", data.tenant_id).eq(column, data.source_party_id);
      if (error) throw new Error(`${tbl}: ${error.message}`);
      counts[tbl] = count ?? 0;
    }
    if (deps.partyChildTables.some((t) => t.table === "party_contacts")) {
      const { data: tContacts } = await deps.supabaseAdmin.from("party_contacts").select("id, email, is_primary, linked_user_id, created_at, active").eq("tenant_id", data.tenant_id).eq("party_id", data.target_party_id);
      const contactDupGroups = /* @__PURE__ */ new Map();
      for (const c of tContacts ?? []) {
        const key = (c.email ?? "").trim().toLowerCase();
        if (!key) continue;
        const arr = contactDupGroups.get(key) ?? [];
        arr.push(c);
        contactDupGroups.set(key, arr);
      }
      let contactsMerged = 0;
      for (const [, rows] of contactDupGroups) {
        if (rows.length < 2) continue;
        rows.sort((a, b) => {
          const score = (r) => (r.linked_user_id ? 0 : 1) * 10 + (r.is_primary ? 0 : 1) * 5 + (r.active ? 0 : 1);
          const s = score(a) - score(b);
          if (s !== 0) return s;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
        const keepIds = [rows[0].id];
        const drop = rows.slice(1).map((r) => r.id);
        contactsMerged += drop.length;
        await deps.supabaseAdmin.from("party_contacts").delete().in("id", drop).eq("tenant_id", data.tenant_id);
        await deps.supabaseAdmin.from("party_contacts").update({ is_primary: true }).in("id", keepIds);
      }
      counts["party_contacts_deduped"] = contactsMerged;
    }
    if (deps.partyChildTables.some((t) => t.table === "party_bank_accounts")) {
      const { data: tBanks } = await deps.supabaseAdmin.from("party_bank_accounts").select("id, account_number, routing_number, created_at, archived_at").eq("tenant_id", data.tenant_id).eq("party_id", data.target_party_id);
      const bankDupGroups = /* @__PURE__ */ new Map();
      for (const b of tBanks ?? []) {
        const key = `${(b.account_number ?? "").trim()}|${(b.routing_number ?? "").trim()}`;
        if (!b.account_number) continue;
        const arr = bankDupGroups.get(key) ?? [];
        arr.push(b);
        bankDupGroups.set(key, arr);
      }
      let banksMerged = 0;
      for (const [, rows] of bankDupGroups) {
        if (rows.length < 2) continue;
        rows.sort((a, b) => {
          const s = (a.archived_at ? 1 : 0) - (b.archived_at ? 1 : 0);
          if (s !== 0) return s;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
        const drop = rows.slice(1).map((r) => r.id);
        banksMerged += drop.length;
        await deps.supabaseAdmin.from("party_bank_accounts").delete().in("id", drop).eq("tenant_id", data.tenant_id);
      }
      counts["party_bank_accounts_deduped"] = banksMerged;
    }
    const { error: delErr } = await deps.supabaseAdmin.from("parties").delete().eq("tenant_id", data.tenant_id).eq("id", data.source_party_id);
    if (delErr) throw new Error(`parties: ${delErr.message}`);
    await deps.supabaseAdmin.from("audit_logs").insert({
      tenant_id: data.tenant_id,
      record_type: "parties",
      record_id: data.target_party_id,
      action: "merged",
      user_id: context.userId,
      old_value: { source_party_id: data.source_party_id, source_name: source.name_en },
      new_value: { target_party_id: data.target_party_id, target_name: target.name_en, reassigned: counts }
    });
    return { ok: true, target_party_id: data.target_party_id, reassigned: counts };
  });
}

export { createAccountResendInvitation, createAccountSendPasswordReset, createAccountUpdateUserProfile, createArchiveParty, createCancelApp, createCleanupPartyContacts, createDeleteParty, createDeletePartyBankAccount, createDeletePartyContact, createGetMyProfile, createGetParty, createGetSuiteHome, createGetTenantSettings, createGetTenantUser, createInvitePartyContact, createInviteTenantUser, createInviteUserToWorkspaces, createListManageableTenants, createListManageableUsers, createListMyAccessibleVendors, createListMyVendorTenants, createListNotifications, createListParties, createListPartyContacts, createListSuiteApps, createListTenantUsers, createMarkAllNotificationsRead, createMarkNotificationRead, createMergeParties, createRemoveTenantUser, createResendInvitation, createRevokePartyContact, createSendPasswordResetLink, createSetAppUrl, createSetTenantUserStatus, createSetUserAppRoles, createSubscribeApp, createUnarchiveParty, createUpdateMyDefaultTenant, createUpdateMyTimezone, createUpdateTenantSettings, createUpdateTenantUserProfile, createUpdateTenantUserRoles, createUpsertParty, createUpsertPartyBankAccount, createUpsertPartyContact, resolveScopedTenantIds };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map