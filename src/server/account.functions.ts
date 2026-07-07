import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type SendEmail = (input: { to: string; subject: string; html: string }) => Promise<any>;

export type AccountDeps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
  sendEmail: SendEmail;
  /** Fallback base URL used to build invite/reset links when APP_BASE_URL is unset, e.g. "https://books.joasuite.com". */
  appBaseUrl: string;
  /** Display name used in transactional emails, e.g. "JoaBooks". */
  appName: string;
  /** Canonical app_code, used as the fallback when a user_roles/app_code row predates multi-app support, e.g. "joabooks". */
  appCode: string;
};

function resolveAppBaseUrl(deps: AccountDeps) {
  return (process.env.APP_BASE_URL || deps.appBaseUrl).replace(/\/$/, "");
}

const APP_ROLES = [
  "owner",
  "super_admin",
  "admin",
  "finance_ap",
  "finance_ar",
  "finance_manager",
  "accountant",
  "approver",
  "vendor",
  "customer",
  "sop_admin",
  "sop_author",
  "sop_reviewer",
  "sop_operator",
] as const;
const AppRole = z.enum(APP_ROLES);
const Portal = z.enum(["internal", "vendor", "approver", "customer"]);

async function getCallerManageableTenantIds(supabaseAdmin: any, userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "super_admin"]);
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  (data ?? []).forEach((r: any) => ids.add(r.tenant_id as string));
  return Array.from(ids);
}

async function assertCallerManagesTenant(supabaseAdmin: any, tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => r === "owner" || r === "super_admin")) {
    throw new Error("Forbidden: owner or super_admin required");
  }
}

async function callerIsOwner(supabaseAdmin: any, tenantId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function getCallerOwnerTenantIds(supabaseAdmin: any, userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("role", "owner");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r: any) => r.tenant_id as string)));
}

async function findOrInviteUserForAccount(
  deps: AccountDeps,
  email: string,
  displayName?: string,
  primaryTenantId?: string,
) {
  const { data: existing, error } = await deps.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(error.message);
  const match = existing.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    return { user: match, created: false, actionLink: null as string | null };
  }
  const base = resolveAppBaseUrl(deps);
  const redirectTo = primaryTenantId
    ? `${base}/reset-password?tenant=${encodeURIComponent(primaryTenantId)}`
    : `${base}/reset-password`;
  const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { display_name: displayName ?? null, primary_tenant_id: primaryTenantId ?? null },
    },
  });
  if (linkErr) throw new Error(`Failed to generate invite link: ${linkErr.message}`);
  if (!link?.user) throw new Error("Invite did not return a user");
  return {
    user: link.user,
    created: true,
    actionLink: link.properties?.action_link ?? null,
  };
}

async function sendMultiOrgInviteEmail(
  deps: AccountDeps,
  opts: {
    email: string;
    display_name?: string;
    created: boolean;
    actionLink: string | null;
    tenantNames: string[];
    primaryTenantName?: string | null;
  },
) {
  const safe = (s: string) => String(s).replace(/[<>&]/g, "");
  const primary = opts.primaryTenantName ?? opts.tenantNames[0] ?? "your workspace";
  const others = opts.tenantNames.filter((n) => n !== primary);
  const orgListHtml = [
    `<li><strong>${safe(primary)}</strong> <span style="color:#677084">(primary)</span></li>`,
    ...others.map((n) => `<li>${safe(n)}</li>`),
  ].join("");
  const subject = opts.created
    ? `You've been invited to ${safe(primary)} on JoaSuite`
    : `You've been added to ${safe(primary)} on JoaSuite`;
  const link = opts.actionLink ?? "";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
      <h2 style="margin:0 0 12px 0">JoaSuite</h2>
      <p>Hi${opts.display_name ? " " + safe(opts.display_name) : ""},</p>
      <p>You have been ${opts.created ? "invited" : "added"} to <strong>${safe(primary)}</strong> on JoaSuite${others.length > 0 ? `, and also to ${others.length} other workspace${others.length > 1 ? "s" : ""}` : ""}.</p>
      <ul>${orgListHtml}</ul>
      ${
        link
          ? `<p style="margin:24px 0"><a href="${link}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Set password &amp; sign in to ${safe(primary)}</a></p>
             <p style="color:#677084;font-size:13px">This link will let you create your password and sign you in to <strong>${safe(primary)}</strong>. It expires soon, so please use it right away.</p>`
          : ``
      }
      <p style="color:#677084;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return deps.sendEmail({ to: opts.email, subject, html });
}

const AppAssignment = z.object({
  app_code: z.string().min(1).max(64),
  roles: z.array(AppRole).min(1),
});

async function assertAppsSubscribed(supabaseAdmin: any, tenantId: string, appCodes: string[]) {
  if (appCodes.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from("tenant_apps")
    .select("app_code")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .in("app_code", appCodes);
  if (error) throw new Error(error.message);
  const active = new Set((data ?? []).map((r: any) => r.app_code as string));
  const missing = appCodes.filter((c) => !active.has(c));
  if (missing.length > 0) {
    throw new Error(`Apps not subscribed for this workspace: ${missing.join(", ")}`);
  }
}

async function assertCallerCanManageUser(
  supabaseAdmin: any,
  callerId: string,
  targetUserId: string,
): Promise<string[]> {
  const tenantIds = await getCallerManageableTenantIds(supabaseAdmin, callerId);
  if (tenantIds.length === 0) throw new Error("Forbidden: no manageable workspaces");
  const { data, error } = await supabaseAdmin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", targetUserId)
    .in("tenant_id", tenantIds);
  if (error) throw new Error(error.message);
  const shared = (data ?? []).map((r: any) => r.tenant_id as string);
  if (shared.length === 0) throw new Error("Forbidden: target user is not in any of your workspaces");
  return shared;
}

async function getTargetEmail(
  supabaseAdmin: any,
  targetUserId: string,
): Promise<{ email: string; display_name: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("tenant_users")
    .select("email, display_name")
    .eq("user_id", targetUserId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.email) throw new Error("User has no email on file");
  return { email: data.email as string, display_name: (data.display_name as string | null) ?? null };
}

// Tenants the caller can manage in the People matrix.
export function createListManageableTenants(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async ({ context }) => {
      const userId = (context as any).userId as string;
      const ids = await getCallerManageableTenantIds(deps.supabaseAdmin, userId);
      if (ids.length === 0) return [];
      const { data, error } = await deps.supabaseAdmin
        .from("tenants")
        .select("id, name, slug, plan")
        .in("id", ids)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    });
}

// Matrix of users across all manageable tenants.
// Returns rows keyed by user_id with email/display_name and an assignments map.
export function createListManageableUsers(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async ({ context }) => {
      const userId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      const tenantIds = await getCallerManageableTenantIds(supabaseAdmin, userId);
      if (tenantIds.length === 0) return { tenants: [], users: [] };

      const [{ data: tenants }, { data: members }, { data: roleRows }, { data: appRows }] =
        await Promise.all([
          supabaseAdmin.from("tenants").select("id, name, slug").in("id", tenantIds).order("name"),
          supabaseAdmin
            .from("tenant_users")
            .select("tenant_id, user_id, portal, status, display_name, email, position, joined_at, created_at")
            .in("tenant_id", tenantIds),
          supabaseAdmin
            .from("user_roles")
            .select("tenant_id, user_id, role, app_code")
            .in("tenant_id", tenantIds),
          supabaseAdmin
            .from("tenant_apps")
            .select("tenant_id, app_code, status, plan")
            .in("tenant_id", tenantIds)
            .eq("status", "active"),
        ]);

      // roles grouped by (tenant|user|app_code)
      const rolesByCell = new Map<string, string[]>();
      (roleRows ?? []).forEach((r: any) => {
        const k = `${r.tenant_id}|${r.user_id}|${r.app_code ?? deps.appCode}`;
        const arr = rolesByCell.get(k) ?? [];
        arr.push(r.role as string);
        rolesByCell.set(k, arr);
      });

      // subscribed apps per tenant
      const appsByTenant = new Map<string, string[]>();
      const planByTenantApp = new Map<string, string | null>();
      (appRows ?? []).forEach((r: any) => {
        const arr = appsByTenant.get(r.tenant_id as string) ?? [];
        arr.push(r.app_code as string);
        appsByTenant.set(r.tenant_id as string, arr);
        planByTenantApp.set(`${r.tenant_id}|${r.app_code}`, (r.plan as string | null) ?? null);
      });

      // last_sign_in_at + auth created_at from Supabase auth admin (paginated, best-effort)
      const lastSignInByUid = new Map<string, string | null>();
      const authCreatedByUid = new Map<string, string | null>();
      try {
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) break;
          (data?.users ?? []).forEach((u: any) => {
            lastSignInByUid.set(u.id, (u as any).last_sign_in_at ?? null);
            authCreatedByUid.set(u.id, (u as any).created_at ?? null);
          });
          if (!data?.users || data.users.length < 200) break;
        }
      } catch {
        // best-effort
      }

      type Assignment = {
        tenant_id: string;
        portal: string;
        status: string;
        joined_at: string | null;
        position: string | null;
        apps: Record<string, { roles: string[] }>;
      };
      type UserRow = {
        user_id: string;
        email: string | null;
        display_name: string | null;
        position: string | null;
        joined_at: string | null;
        last_sign_in_at: string | null;
        assignments: Record<string, Assignment>;
      };

      const usersByUid = new Map<string, UserRow>();
      (members ?? []).filter((m: any) => (m.portal as string) === "internal").forEach((m: any) => {
        const uid = m.user_id as string;
        const tid = m.tenant_id as string;
        const joined = (m.joined_at as string | null) ?? (m.created_at as string | null) ?? null;
        const pos = (m.position as string | null) ?? null;
        let row = usersByUid.get(uid);
        if (!row) {
          row = {
            user_id: uid,
            email: (m.email as string | null) ?? null,
            display_name: (m.display_name as string | null) ?? null,
            position: pos,
            joined_at: joined,
            last_sign_in_at: lastSignInByUid.get(uid) ?? null,
            assignments: {},
          };
          usersByUid.set(uid, row);
        } else {
          if (!row.email && m.email) row.email = m.email as string;
          if (!row.display_name && m.display_name) row.display_name = m.display_name as string;
          if (!row.position && pos) row.position = pos;
          if (joined && (!row.joined_at || joined < row.joined_at)) row.joined_at = joined;
        }
        const apps: Record<string, { roles: string[] }> = {};
        const tenantApps = appsByTenant.get(tid) ?? [];
        const codes = new Set<string>(tenantApps);
        (roleRows ?? [])
          .filter((r: any) => r.tenant_id === tid && r.user_id === uid)
          .forEach((r: any) => codes.add((r.app_code as string) ?? deps.appCode));
        codes.forEach((code) => {
          apps[code] = { roles: rolesByCell.get(`${tid}|${uid}|${code}`) ?? [] };
        });
        row.assignments[tid] = {
          tenant_id: tid,
          portal: (m.portal as string) ?? "internal",
          status: (m.status as string) ?? "active",
          joined_at: joined,
          position: pos,
          apps,
        };
      });

      // fall back to auth.created_at when tenant_users has no joined_at
      usersByUid.forEach((row) => {
        if (!row.joined_at) row.joined_at = authCreatedByUid.get(row.user_id) ?? null;
      });

      const users = Array.from(usersByUid.values()).sort((a, b) =>
        (a.email ?? "").localeCompare(b.email ?? ""),
      );

      const tenantsWithApps = (tenants ?? []).map((t: any) => {
        const codes = appsByTenant.get(t.id as string) ?? [];
        return {
          ...t,
          app_codes: codes,
          app_plans: Object.fromEntries(
            codes.map((c) => [c, planByTenantApp.get(`${t.id}|${c}`) ?? null]),
          ) as Record<string, string | null>,
        };
      });

      return {
        tenants: tenantsWithApps,
        users,
        caller_owner_tenant_ids: await getCallerOwnerTenantIds(supabaseAdmin, userId),
      };
    });
}

// Invite (or add existing) a user to one or more workspaces at once.
// Each assignment is per (tenant, app, roles[]).
export function createInviteUserToWorkspaces(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z
        .object({
          email: z.string().email(),
          display_name: z.string().min(1).max(120),
          position: z.string().max(120).optional(),
          primary_tenant_id: z.string().uuid().optional(),
          assignments: z
            .array(
              z.object({
                tenant_id: z.string().uuid(),
                portal: Portal.default("internal"),
                apps: z.array(AppAssignment).default([]),
              }),
            )
            .min(1),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      for (const a of data.assignments) {
        await assertCallerManagesTenant(supabaseAdmin, a.tenant_id, callerId);
        const wantsOwner = a.apps.some((ap: any) => ap.roles.includes("owner" as any));
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
            a.apps.map((x: any) => x.app_code),
          );
        }
      }

      // Determine primary tenant: explicit input, or first assignment.
      const primaryTenantId =
        data.primary_tenant_id &&
        data.assignments.some((a: any) => a.tenant_id === data.primary_tenant_id)
          ? data.primary_tenant_id
          : data.assignments[0].tenant_id;

      const invited = await findOrInviteUserForAccount(
        deps,
        data.email,
        data.display_name,
        primaryTenantId,
      );

      const { data: tenants } = await supabaseAdmin
        .from("tenants")
        .select("id, name")
        .in(
          "id",
          data.assignments.map((a: any) => a.tenant_id),
        );
      const nameById = new Map<string, string>();
      (tenants ?? []).forEach((t: any) => nameById.set(t.id as string, (t.name as string) ?? ""));

      const addedTenants: string[] = [];
      for (const a of data.assignments) {
        const { error: muErr } = await supabaseAdmin
          .from("tenant_users")
          .upsert(
            {
              tenant_id: a.tenant_id,
              user_id: invited.user.id,
              portal: a.portal,
              status: "active",
              display_name: data.display_name,
              email: invited.user.email ?? data.email,
              position: data.position ?? null,
              invited_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,user_id" },
          );
        if (muErr) throw new Error(muErr.message);

        const rows = a.apps.flatMap((ap: any) =>
          ap.roles.map((r: any) => ({
            tenant_id: a.tenant_id,
            user_id: invited.user.id,
            role: r,
            app_code: ap.app_code,
          })),
        );
        if (rows.length > 0) {
          const { error: rErr } = await supabaseAdmin
            .from("user_roles")
            .upsert(rows, { onConflict: "tenant_id,user_id,role,app_code" });
          if (rErr) throw new Error(rErr.message);
        }
        addedTenants.push(nameById.get(a.tenant_id) ?? "");
      }

      const primaryName = nameById.get(primaryTenantId) ?? addedTenants[0] ?? null;

      let emailResult: Awaited<ReturnType<typeof sendMultiOrgInviteEmail>> | null = null;
      if (invited.created) {
        emailResult = await sendMultiOrgInviteEmail(deps, {
          email: data.email,
          display_name: data.display_name,
          created: invited.created,
          actionLink: invited.actionLink,
          tenantNames: addedTenants.filter(Boolean),
          primaryTenantName: primaryName,
        });
      }

      return {
        user_id: invited.user.id,
        created: invited.created,
        tenants_added: addedTenants.length,
        primary_tenant_id: primaryTenantId,
        email: emailResult,
      };
    });
}

// Replace the roles a user has for one (tenant, app) cell. Empty roles[] removes app access.
export function createSetUserAppRoles(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          user_id: z.string().uuid(),
          app_code: z.string().min(1).max(64),
          roles: z.array(AppRole).default([]),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      await assertCallerManagesTenant(supabaseAdmin, data.tenant_id, callerId);
      if (data.roles.includes("owner" as any)) {
        const isOwner = await callerIsOwner(supabaseAdmin, data.tenant_id, callerId);
        if (!isOwner && data.user_id !== callerId) {
          throw new Error("Only an Owner can grant the Owner role to another user.");
        }
      }
      if (data.roles.length > 0) {
        await assertAppsSubscribed(supabaseAdmin, data.tenant_id, [data.app_code]);
      }
      // Delete only this (tenant, user, app) slice
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .eq("app_code", data.app_code);
      if (delErr) throw new Error(delErr.message);
      if (data.roles.length > 0) {
        const rows = data.roles.map((r: any) => ({
          tenant_id: data.tenant_id,
          user_id: data.user_id,
          role: r,
          app_code: data.app_code,
        }));
        const { error: insErr } = await supabaseAdmin.from("user_roles").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
      return { ok: true };
    });
}

export function createAccountResendInvitation(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      const sharedTenantIds = await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
      const { email, display_name } = await getTargetEmail(supabaseAdmin, data.user_id);
      const { data: tenants } = await supabaseAdmin
        .from("tenants")
        .select("name")
        .in("id", sharedTenantIds);
      const tenantNames = (tenants ?? []).map((t: any) => (t.name as string) ?? "").filter(Boolean);

      const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` },
      });
      if (linkErr) throw new Error(linkErr.message);

      const result = await sendMultiOrgInviteEmail(deps, {
        email,
        display_name: display_name ?? undefined,
        created: false,
        actionLink: link?.properties?.action_link ?? null,
        tenantNames,
      });
      return { ok: true, email: result };
    });
}

export function createAccountSendPasswordReset(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
      const { email, display_name } = await getTargetEmail(supabaseAdmin, data.user_id);

      const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` },
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

export function createAccountUpdateUserProfile(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        user_id: z.string().uuid(),
        display_name: z.string().min(1).max(120),
        email: z.string().email().optional(),
        position: z.string().max(120).nullable().optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      const sharedTenantIds = await assertCallerCanManageUser(supabaseAdmin, callerId, data.user_id);
      const patch: { display_name: string; email?: string; position?: string | null } = { display_name: data.display_name };
      if (data.email) patch.email = data.email;
      if (data.position !== undefined) patch.position = data.position;
      const { error } = await supabaseAdmin
        .from("tenant_users")
        .update(patch as any)
        .eq("user_id", data.user_id)
        .in("tenant_id", sharedTenantIds);
      if (error) throw new Error(error.message);
      if (data.email) {
        // Update auth user email too
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email: data.email,
        });
        if (authErr) throw new Error(authErr.message);
      }
      return { ok: true };
    });
}

// ---------- Profile (self) ----------
export function createGetMyProfile(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async ({ context }) => {
      const userId = (context as any).userId as string;
      const { data, error } = await deps.supabaseAdmin
        .from("profiles")
        .select("id, default_tenant_id, timezone")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        default_tenant_id: (data?.default_tenant_id as string | null) ?? null,
        timezone: ((data as any)?.timezone as string | null) ?? null,
      };
    });
}

export function createUpdateMyTimezone(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ timezone: z.string().min(1).max(100).nullable() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      // Validate IANA zone
      if (data.timezone) {
        try { new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }); }
        catch { throw new Error("Invalid timezone"); }
      }
      const { error } = await deps.supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, timezone: data.timezone } as any, { onConflict: "id" });
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createUpdateMyDefaultTenant(deps: AccountDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid().nullable() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      const supabaseAdmin = deps.supabaseAdmin;
      if (data.tenant_id) {
        // ensure caller is a member of that tenant
        const { data: m, error: mErr } = await supabaseAdmin
          .from("tenant_users")
          .select("tenant_id")
          .eq("tenant_id", data.tenant_id)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (mErr) throw new Error(mErr.message);
        if (!m) throw new Error("Not a member of that workspace");
      }
      const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, default_tenant_id: data.tenant_id } as any, { onConflict: "id" });
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}
