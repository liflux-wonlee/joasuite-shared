import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type SendEmail = (input: { to: string; subject: string; html: string }) => Promise<any>;

/** A doc/child table that references a `parties` row, for mergeParties reassignment. */
export type PartyRefTable = { table: string; column: string; label?: string };

export type AdminDeps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
  sendEmail: SendEmail;
  /** Fallback base URL used to build invite/reset links when APP_BASE_URL is unset. */
  appBaseUrl: string;
  /** Display name used in transactional emails, e.g. "JoaBooks". */
  appName: string;
  /**
   * This app's canonical app_code (e.g. "joabooks", "joaoffice"). Used both
   * as a fallback for legacy rows predating multi-app support, and to scope
   * app-specific role checks (assertOwnerOrAdmin / assertCanEditVendor) so a
   * role granted in a different suite app never satisfies this app's checks.
   */
  appCode: string;
};

export type MergePartiesDeps = AdminDeps & {
  /** Tables that BLOCK a party delete and get REASSIGNED on merge. See each app's party-references.ts. */
  partyDocRefTables: PartyRefTable[];
  /** Owned sub-record tables that get REASSIGNED on merge and cascade (don't block) on delete. */
  partyChildTables: PartyRefTable[];
};

function resolveAppBaseUrl(deps: AdminDeps) {
  return (process.env.APP_BASE_URL || deps.appBaseUrl).replace(/\/$/, "");
}

// Full public.app_role Postgres enum, kept in sync with account.functions.ts's
// APP_ROLES (both used to drift independently; unified here so inviteTenantUser
// can accept any valid role, not just the finance-flavored subset JoaBooks
// originally needed).
const APP_ROLES = [
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
  "sop_operator",
] as const;
const AppRole = z.enum(APP_ROLES);

// Suite-wide roles (owner/super_admin, app_code IS NULL) satisfy every
// app's checks. App-scoped roles (e.g. 'admin') only count when scoped to
// the CALLING app's own appCode - a role held in a different suite app
// must not grant this app's admin access. appCode comes from the
// consuming app's AdminDeps (each app passes its own canonical app_code
// when instantiating these factories).
async function assertOwnerOrAdmin(supabaseAdmin: any, appCode: string, tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, app_code")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ok = rows.some((r: any) => {
    const role = r.role as string;
    const rowAppCode = r.app_code as string | null;
    if (rowAppCode === null) return role === "owner" || role === "super_admin";
    return rowAppCode === appCode && role === "admin";
  });
  if (!ok) throw new Error("Forbidden: admin role required");
}

async function assertCanEditVendor(supabaseAdmin: any, appCode: string, tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, app_code")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ok = rows.some((r: any) => {
    const role = r.role as string;
    const rowAppCode = r.app_code as string | null;
    if (rowAppCode === null) return role === "owner" || role === "super_admin";
    return rowAppCode === appCode && role === "admin";
  });
  if (!ok) throw new Error("Forbidden: vendor edit role required");
}

async function assertTenantMember(supabaseAdmin: any, tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_users")
    .select("id, portal")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a tenant member");
  return data as { id: string; portal: string };
}

/**
 * Internal-staff-only admin data (tenant settings, full user roster with
 * roles, party/vendor CRUD including bank account details) must never be
 * reachable by vendor/customer/approver portal accounts, even though they
 * hold an active tenant_users row.
 */
async function assertInternalTenantMember(supabaseAdmin: any, tenantId: string, userId: string) {
  const member = await assertTenantMember(supabaseAdmin, tenantId, userId);
  if (member.portal !== "internal") throw new Error("Forbidden: internal staff only");
  return member;
}

async function findOrInviteUser(deps: AdminDeps, email: string, displayName?: string) {
  const { data: existing, error: lookupErr } = await deps.supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (lookupErr) throw new Error(lookupErr.message);
  const match = existing.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

  if (match) {
    return { user: match, created: false, alreadyExisted: true, actionLink: null as string | null };
  }

  const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${resolveAppBaseUrl(deps)}/reset-password`,
      data: { display_name: displayName ?? null },
    },
  });
  if (linkErr) throw new Error(`Failed to generate invite link: ${linkErr.message}`);
  if (!link?.user) throw new Error("Invite did not return a user");
  return {
    user: link.user,
    created: true,
    alreadyExisted: false,
    actionLink: link.properties?.action_link ?? null,
  };
}

async function sendInviteEmail(
  deps: AdminDeps,
  opts: {
    email: string;
    display_name?: string;
    created: boolean;
    actionLink: string | null;
    tenantName: string;
    vendorName?: string;
  },
) {
  const subject = opts.created
    ? `You've been invited to ${opts.tenantName} on ${deps.appName}`
    : `You've been added to ${opts.tenantName} on ${deps.appName}`;
  const link = opts.actionLink ?? "";
  const safeName = String(opts.tenantName).replace(/[<>&]/g, "");
  const safeVendorName = opts.vendorName ? String(opts.vendorName).replace(/[<>&]/g, "") : "";
  const signInUrl = `${resolveAppBaseUrl(deps)}/signin`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
      <h2 style="margin:0 0 12px 0">${deps.appName}</h2>
      <p>Hi${opts.display_name ? " " + opts.display_name : ""},</p>
      <p>You have been ${opts.created ? "invited" : "added"} to the <strong>${safeName}</strong> workspace on ${deps.appName}.</p>
      ${safeVendorName ? `<p>You have been invited as a contact for <strong>${safeVendorName}</strong> and can access the vendor portal to view payment requests and submit new ones.</p>` : ""}
      ${
        link
          ? `<p style="margin:24px 0"><a href="${link}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${opts.created ? "Set password &amp; sign in" : "Sign in to " + safeName}</a></p>
             <p style="color:#677084;font-size:13px">${opts.created ? "This link will let you create your password and sign in to" : "This one-time link signs you in to"} <strong>${safeName}</strong>. It expires soon, so please use it right away.</p>`
          : `<p style="margin:24px 0"><a href="${signInUrl}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Sign in</a></p>
             <p style="color:#677084;font-size:13px">Sign in with your existing ${deps.appName} account to access <strong>${safeName}</strong>.</p>`
      }
      <p style="color:#677084;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return deps.sendEmail({ to: opts.email, subject, html });
}

// ---------- Tenant settings ----------
// Non-internal portal members (vendor/customer/approver) legitimately need a
// narrow slice of this (foreign_currency_enabled/primary_currency_code, read
// by the payment-request form to size its currency picker) — but not the
// full settings blob, which internal admins can put arbitrary config into.
const VENDOR_SAFE_SETTINGS_KEYS = ["foreign_currency_enabled", "primary_currency_code"] as const;

export function createGetTenantSettings(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const member = await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const { data: t, error } = await deps.supabaseAdmin
        .from("tenants")
        .select("id, name, slug, status, settings")
        .eq("id", data.tenant_id)
        .single();
      if (error) throw new Error(error.message);

      const settings = (t.settings ?? {}) as Record<string, any>;
      if (member.portal === "internal") return { ...t, settings };

      const filteredSettings: Record<string, any> = {};
      for (const k of VENDOR_SAFE_SETTINGS_KEYS) {
        if (k in settings) filteredSettings[k] = settings[k];
      }
      return { ...t, settings: filteredSettings };
    });
}

export function createUpdateTenantSettings(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        settings: z.record(z.string(), z.any()).optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const patch: { name?: string; settings?: Record<string, unknown> } = {};
      if (data.name) patch.name = data.name;
      if (data.settings) patch.settings = data.settings;
      const { data: t, error } = await deps.supabaseAdmin
        .from("tenants")
        .update(patch as never)
        .eq("id", data.tenant_id)
        .select("id, name, settings")
        .single();
      if (error) throw new Error(error.message);
      return t;
    });
}

// ---------- Tenant users ----------
export function createListTenantUsers(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      await assertInternalTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const { data: members, error } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at")
        .eq("tenant_id", data.tenant_id)
        .order("created_at");
      if (error) throw new Error(error.message);
      const { data: roles } = await deps.supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", data.tenant_id);
      const byUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = byUser.get(r.user_id as string) ?? [];
        arr.push(r.role as string);
        byUser.set(r.user_id as string, arr);
      });
      return (members ?? []).map((m: any) => ({ ...m, roles: byUser.get(m.user_id as string) ?? [] }));
    });
}

export function createGetTenantUser(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertInternalTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const { data: m, error } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .single();
      if (error) throw new Error(error.message);
      const { data: roles } = await deps.supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id);
      return { ...m, roles: (roles ?? []).map((r: any) => r.role as string) };
    });
}

export function createUpdateTenantUserProfile(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        user_id: z.string().uuid(),
        display_name: z.string().min(1).max(120),
        position: z.string().max(120).optional().nullable(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("tenant_users")
        .update({ display_name: data.display_name, position: data.position ?? null })
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

/**
 * Has this signed-in user ever held ANY tenant_users row, in any tenant,
 * regardless of status? Used by PostLoginGate to tell a brand-new signup
 * (never had one) apart from someone whose only membership was removed or
 * deactivated (had one, doesn't anymore) — those two cases need different
 * copy, since "create an organization" is misleading for the latter.
 */
export function createHasEverHadMembership(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async ({ context }) => {
      const { data, error } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("id")
        .eq("user_id", (context as any).userId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { ever: !!data };
    });
}

export function createInviteTenantUser(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        email: z.string().email(),
        display_name: z.string().min(1, "Name is required").max(120),
        position: z.string().max(120).optional(),
        portal: z.enum(["internal", "vendor", "approver", "customer"]).default("internal"),
        roles: z.array(AppRole).default([]),
        party_id: z.string().uuid().optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      if (data.portal === "vendor") {
        await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      } else {
        await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      }
      const invited = await findOrInviteUser(deps, data.email, data.display_name);

      const { data: tenantRow } = await deps.supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", data.tenant_id)
        .single();
      const tenantName = tenantRow?.name ?? "your workspace";

      const { data: existingMembership } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", invited.user.id)
        .maybeSingle();
      const alreadyMember = !!existingMembership;

      const { error: muErr } = await deps.supabaseAdmin
        .from("tenant_users")
        .upsert(
          {
            tenant_id: data.tenant_id,
            user_id: invited.user.id,
            portal: data.portal,
            status: "active",
            display_name: data.display_name,
            email: invited.user.email ?? data.email,
            position: data.position ?? null,
            invited_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,user_id" },
        );
      if (muErr) throw new Error(muErr.message);

      if (data.roles.length > 0) {
        // app_code scopes each role to the calling app — omitting it would
        // land the row as a suite-wide (app_code IS NULL) grant, which per
        // this file's own convention should only ever hold owner/super_admin.
        const rows = data.roles.map((r: any) => ({
          tenant_id: data.tenant_id,
          user_id: invited.user.id,
          role: r,
          app_code: r === "owner" || r === "super_admin" ? null : deps.appCode,
        }));
        const { error: rErr } = await deps.supabaseAdmin
          .from("user_roles")
          .upsert(rows, { onConflict: "tenant_id,user_id,role,app_code" });
        if (rErr) throw new Error(rErr.message);
      }

      if (data.party_id) {
        const { error: pErr } = await deps.supabaseAdmin
          .from("parties")
          .update({ linked_user_id: invited.user.id })
          .eq("id", data.party_id)
          .eq("tenant_id", data.tenant_id);
        if (pErr) throw new Error(pErr.message);
      }

      let actionLink: string | null = invited.actionLink;
      if (!invited.created) {
        const confirmed = !!(invited.user as { email_confirmed_at?: string | null }).email_confirmed_at;
        const { data: link } = await deps.supabaseAdmin.auth.admin.generateLink({
          type: confirmed ? "magiclink" : "invite",
          email: data.email,
          options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` },
        });
        actionLink = link?.properties?.action_link ?? null;
      }
      const emailResult = await sendInviteEmail(deps, {
        email: data.email,
        display_name: data.display_name,
        created: invited.created,
        actionLink,
        tenantName,
      });

      return {
        user_id: invited.user.id,
        created: invited.created,
        added_existing: invited.alreadyExisted,
        already_member: alreadyMember,
        email: emailResult,
      };
    });
}

export function createResendInvitation(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { data: m, error } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("email, display_name")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .single();
      if (error) throw new Error(error.message);
      if (!m.email) throw new Error("User has no email on file");

      const { data: tenantRow } = await deps.supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", data.tenant_id)
        .single();
      const tenantName = tenantRow?.name ?? "your workspace";

      const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: m.email,
        options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` },
      });
      if (linkErr) throw new Error(linkErr.message);

      const result = await sendInviteEmail(deps, {
        email: m.email,
        display_name: m.display_name ?? undefined,
        created: false,
        actionLink: link?.properties?.action_link ?? null,
        tenantName,
      });
      return { ok: true, email: result };
    });
}

export function createSendPasswordResetLink(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { data: m, error } = await deps.supabaseAdmin
        .from("tenant_users")
        .select("email, display_name")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .single();
      if (error) throw new Error(error.message);
      if (!m.email) throw new Error("User has no email on file");

      const { data: link, error: linkErr } = await deps.supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: m.email,
        options: { redirectTo: `${resolveAppBaseUrl(deps)}/reset-password` },
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

// DEPRECATED: kept for backward compatibility — applies roles to ALL of the user's
// existing app_codes in this tenant. Prefer setUserAppRoles in account.functions.ts.
export function createUpdateTenantUserRoles(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        user_id: z.string().uuid(),
        roles: z.array(AppRole),
        app_code: z.string().min(1).max(64).optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const appCode = data.app_code ?? deps.appCode;
      const { error: delErr } = await deps.supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .eq("app_code", appCode);
      if (delErr) throw new Error(delErr.message);
      if (data.roles.length > 0) {
        const rows = data.roles.map((r: any) => ({
          tenant_id: data.tenant_id,
          user_id: data.user_id,
          role: r,
          app_code: appCode,
        }));
        const { error } = await deps.supabaseAdmin.from("user_roles").insert(rows);
        if (error) throw new Error(error.message);
      }
      return { ok: true };
    });
}

export function createSetTenantUserStatus(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        user_id: z.string().uuid(),
        status: z.enum(["active", "invited", "suspended"]),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertOwnerOrAdmin(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("tenant_users")
        .update({ status: data.status })
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

// Remove a user's access to THIS app from this workspace. Owner/super_admin
// only. App-scoped: deletes ONLY user_roles rows tagged deps.appCode. Roles
// for other suite apps and suite-wide owner/super_admin rows (app_code IS
// NULL) are left untouched. The shared tenant_users membership row is only
// removed when the user has no remaining roles in this tenant at all, so a
// member who still belongs to other apps keeps showing up there.
export function createRemoveTenantUser(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        user_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const callerId = context.userId as string;
      if (data.user_id === callerId) {
        throw new Error("You cannot remove yourself. Use 'Leave organization' instead.");
      }
      const { data: callerRoles, error: crErr } = await deps.supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", callerId);
      if (crErr) throw new Error(crErr.message);
      const callerSet = new Set((callerRoles ?? []).map((r: any) => r.role as string));
      if (!callerSet.has("owner") && !callerSet.has("super_admin")) {
        throw new Error("Forbidden: owner or super_admin required");
      }
      const { data: targetRoles, error: trErr } = await deps.supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id);
      if (trErr) throw new Error(trErr.message);
      if ((targetRoles ?? []).some((r: any) => r.role === "owner")) {
        throw new Error("Cannot remove an owner. Transfer ownership first.");
      }
      // Delete ONLY this app's role rows. Never touch other apps' or
      // suite-wide rows.
      const { error: rolesErr } = await deps.supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .eq("app_code", deps.appCode);
      if (rolesErr) throw new Error(rolesErr.message);

      // If the user has no remaining roles in this tenant (any app, incl.
      // NULL), drop the shared membership row too. Otherwise keep it so
      // other apps still see the member.
      const { data: remaining, error: remErr } = await deps.supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .eq("user_id", data.user_id)
        .limit(1);
      if (remErr) throw new Error(remErr.message);
      if ((remaining ?? []).length === 0) {
        const { error: memErr } = await deps.supabaseAdmin
          .from("tenant_users")
          .delete()
          .eq("tenant_id", data.tenant_id)
          .eq("user_id", data.user_id);
        if (memErr) throw new Error(memErr.message);
      }
      return { ok: true };
    });
}

// ---------- Parties (vendors / customers) ----------
export function createListParties(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        kind: z.enum(["all", "vendor", "customer"]).default("all"),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertInternalTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      let q = deps.supabaseAdmin
        .from("parties")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .order("name_en");
      if (data.kind === "vendor") q = q.eq("is_vendor", true);
      if (data.kind === "customer") q = q.eq("is_customer", true);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const list = rows ?? [];

      const linkedIds = Array.from(
        new Set(list.map((p: any) => p.linked_user_id).filter((x: any): x is string => !!x)),
      );
      const signedInMap = new Map<string, boolean>();
      if (linkedIds.length > 0) {
        const { data: usersPage } = await deps.supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        for (const u of usersPage?.users ?? []) {
          if (linkedIds.includes(u.id)) {
            signedInMap.set(u.id, !!u.last_sign_in_at);
          }
        }
      }
      return list.map((p: any) => ({
        ...p,
        linked_signed_in: p.linked_user_id ? signedInMap.get(p.linked_user_id) ?? false : false,
      }));
    });
}

export function createUpsertParty(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
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
        internal_notes: z.string().max(2000).optional().nullable(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { id, ...rest } = data;
      const row = {
        ...rest,
        contact_email: rest.contact_email === "" ? null : rest.contact_email,
      };
      if (id) {
        const { error } = await deps.supabaseAdmin.from("parties").update(row).eq("id", id);
        if (error) throw new Error(error.message);
        return { id };
      }
      const { data: ins, error } = await deps.supabaseAdmin
        .from("parties")
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id };
    });
}

export function createDeleteParty(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("parties")
        .delete()
        .eq("id", data.party_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createGetParty(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertInternalTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const { data: row, error } = await deps.supabaseAdmin
        .from("parties")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.party_id)
        .single();
      if (error) throw new Error(error.message);
      const [{ data: banks }, { data: contacts }] = await Promise.all([
        deps.supabaseAdmin
          .from("party_bank_accounts")
          .select("*")
          .eq("party_id", data.party_id)
          .order("archived_at", { ascending: true, nullsFirst: true })
          .order("created_at", { ascending: true }),
        deps.supabaseAdmin
          .from("party_contacts")
          .select("*")
          .eq("party_id", data.party_id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
      ]);
      const allBanks: any[] = (banks ?? []) as any[];
      const active = allBanks.filter((b) => !b.archived_at);
      const history = allBanks.filter((b) => !!b.archived_at);
      return {
        party: row,
        bank_accounts: active,
        bank_accounts_history: history,
        contacts: contacts ?? [],
      };
    });
}

// ---------- Party contacts (multiple per vendor, portal-invitable) ----------
export function createListPartyContacts(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertInternalTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("party_contacts")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return rows ?? [];
    });
}

export function createUpsertPartyContact(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        email: z.string().email().optional().nullable().or(z.literal("")),
        phone: z.string().max(60).optional().nullable(),
        role_note: z.string().max(300).optional().nullable(),
        is_primary: z.boolean().optional(),
        active: z.boolean().optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const row = {
        tenant_id: data.tenant_id,
        party_id: data.party_id,
        name: data.name,
        email: data.email === "" ? null : data.email ?? null,
        phone: data.phone ?? null,
        role_note: data.role_note ?? null,
        is_primary: data.is_primary ?? false,
        active: data.active ?? true,
      };
      if (data.id) {
        const { error } = await deps.supabaseAdmin
          .from("party_contacts")
          .update(row)
          .eq("id", data.id)
          .eq("tenant_id", data.tenant_id);
        if (error) throw new Error(error.message);
        return { id: data.id };
      }
      const { data: ins, error } = await deps.supabaseAdmin
        .from("party_contacts")
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id };
    });
}

export function createDeletePartyContact(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        contact_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("party_contacts")
        .delete()
        .eq("id", data.contact_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

// Invites a party contact to the VENDOR portal specifically (hardcoded
// portal: "vendor" / role: "vendor"). Not yet generic across portal types —
// an app needing a different portal-invite flow should add its own function.
export function createInvitePartyContact(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        contact_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { data: c, error: ce } = await deps.supabaseAdmin
        .from("party_contacts")
        .select("id, name, email, party_id, tenant_id")
        .eq("id", data.contact_id)
        .eq("tenant_id", data.tenant_id)
        .single();
      if (ce) throw new Error(ce.message);
      if (!c.email) throw new Error("Contact has no email");

      const invited = await findOrInviteUser(deps, c.email, c.name);

      const { data: tenantRow } = await deps.supabaseAdmin
        .from("tenants").select("name").eq("id", data.tenant_id).single();
      const tenantName = tenantRow?.name ?? "your workspace";

      const { data: partyRow } = await deps.supabaseAdmin
        .from("parties").select("name_en").eq("id", c.party_id).single();
      const vendorName = partyRow?.name_en ?? "";

      await deps.supabaseAdmin
        .from("tenant_users")
        .upsert(
          {
            tenant_id: data.tenant_id,
            user_id: invited.user.id,
            portal: "vendor",
            status: "active",
            display_name: c.name,
            email: invited.user.email ?? c.email,
            invited_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,user_id" },
        );

      await deps.supabaseAdmin
        .from("user_roles")
        .upsert(
          { tenant_id: data.tenant_id, user_id: invited.user.id, role: "vendor" },
          { onConflict: "tenant_id,user_id,role,app_code" },
        );

      await deps.supabaseAdmin
        .from("party_contacts")
        .update({ linked_user_id: invited.user.id, invited_at: new Date().toISOString() })
        .eq("id", c.id);

      const emailResult = await sendInviteEmail(deps, {
        email: c.email,
        display_name: c.name,
        created: invited.created,
        actionLink: invited.actionLink,
        tenantName,
        vendorName,
      });
      return { ok: true, user_id: invited.user.id, email: emailResult };
    });
}

export function createRevokePartyContact(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        contact_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("party_contacts")
        .update({ linked_user_id: null, invited_at: null })
        .eq("id", data.contact_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

/**
 * List parties (of any category — vendors, customers, and per the JoaSuite
 * employee/party design, eventually employees too) the current user has
 * portal access to in the given tenant — either as the main linked user on
 * parties.linked_user_id, OR as an active linked contact in party_contacts.
 * Named for its original vendor-portal use case; the underlying query is
 * generic to any party category.
 */
export function createListMyAccessibleVendors(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      await assertTenantMember(deps.supabaseAdmin, data.tenant_id, context.userId);
      const [{ data: direct, error: e1 }, { data: viaContacts, error: e2 }] = await Promise.all([
        deps.supabaseAdmin
          .from("parties")
          .select("id")
          .eq("tenant_id", data.tenant_id)
          .eq("linked_user_id", context.userId)
          .eq("active", true),
        deps.supabaseAdmin
          .from("party_contacts")
          .select("party_id")
          .eq("tenant_id", data.tenant_id)
          .eq("linked_user_id", context.userId)
          .eq("active", true),
      ]);
      if (e1) throw new Error(e1.message);
      if (e2) throw new Error(e2.message);
      const ids = new Set<string>();
      (direct ?? []).forEach((r: any) => ids.add(r.id));
      (viaContacts ?? []).forEach((r: any) => r.party_id && ids.add(r.party_id));
      if (ids.size === 0) return [] as Array<{ id: string; name_en: string; nick_name: string | null }>;
      const { data: parties, error } = await deps.supabaseAdmin
        .from("parties")
        .select("id, name_en, nick_name")
        .in("id", Array.from(ids))
        .eq("active", true)
        .order("name_en");
      if (error) throw new Error(error.message);
      return parties ?? [];
    });
}

export function createListMyVendorTenants(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async ({ context }) => {
      const userId = context.userId;
      const [{ data: direct }, { data: viaContacts }] = await Promise.all([
        deps.supabaseAdmin
          .from("parties")
          .select("tenant_id")
          .eq("linked_user_id", userId)
          .eq("active", true),
        deps.supabaseAdmin
          .from("party_contacts")
          .select("tenant_id")
          .eq("linked_user_id", userId)
          .eq("active", true),
      ]);
      const ids = new Set<string>();
      (direct ?? []).forEach((r: any) => r.tenant_id && ids.add(r.tenant_id));
      (viaContacts ?? []).forEach((r: any) => r.tenant_id && ids.add(r.tenant_id));
      return Array.from(ids);
    });
}

// ---------- Party bank accounts ----------
const BankAccountInput = z.object({
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
  bank_addr_zip: z.string().nullable().optional(),
});

// NOTE: the "archive instead of overwrite when referenced by a payment
// request" protection is JoaBooks-specific (checks payment_requests). Other
// apps get the plain update/insert path, which is correct, just without that
// extra protection — add an equivalent check via your own party-references
// registry if you need it.
export function createUpsertPartyBankAccount(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
        bank: BankAccountInput,
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
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
        bank_addr_zip: data.bank.bank_addr_zip ?? null,
      };
      if (data.bank.id) {
        const { count: refCount } = await deps.supabaseAdmin
          .from("payment_requests")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", data.tenant_id)
          .eq("party_bank_account_id", data.bank.id);
        if ((refCount ?? 0) > 0) {
          const { data: newRow, error: insErr } = await deps.supabaseAdmin
            .from("party_bank_accounts")
            .insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          const { error: archErr } = await deps.supabaseAdmin
            .from("party_bank_accounts")
            .update({
              archived_at: new Date().toISOString(),
              archived_by: context.userId,
              archive_reason: "replaced",
              replaced_by_id: newRow.id,
            } as never)
            .eq("id", data.bank.id)
            .eq("tenant_id", data.tenant_id);
          if (archErr) throw new Error(archErr.message);
          return { id: newRow.id as string, archived_previous: true };
        }
        const { error } = await deps.supabaseAdmin
          .from("party_bank_accounts")
          .update(patch as never)
          .eq("id", data.bank.id)
          .eq("tenant_id", data.tenant_id);
        if (error) throw new Error(error.message);
        return { id: data.bank.id, archived_previous: false };
      }
      const { data: row, error } = await deps.supabaseAdmin
        .from("party_bank_accounts")
        .insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id as string, archived_previous: false };
    });
}

// Same JoaBooks-specific reference-check caveat as createUpsertPartyBankAccount.
export function createDeletePartyBankAccount(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        bank_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { count: refCount } = await deps.supabaseAdmin
        .from("payment_requests")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", data.tenant_id)
        .eq("party_bank_account_id", data.bank_id);
      if ((refCount ?? 0) > 0) {
        const { error } = await deps.supabaseAdmin
          .from("party_bank_accounts")
          .update({
            archived_at: new Date().toISOString(),
            archived_by: context.userId,
            archive_reason: "deleted",
          } as never)
          .eq("id", data.bank_id)
          .eq("tenant_id", data.tenant_id);
        if (error) throw new Error(error.message);
        return { ok: true, archived: true };
      }
      const { error } = await deps.supabaseAdmin
        .from("party_bank_accounts")
        .delete()
        .eq("id", data.bank_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true, archived: false };
    });
}

// ---------- Party lifecycle: archive / unarchive / dedupe / merge ----------
export function createArchiveParty(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("parties")
        .update({
          archived_at: new Date().toISOString(),
          archived_by: context.userId,
          archive_reason: data.reason ?? null,
        })
        .eq("id", data.party_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createUnarchiveParty(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { error } = await deps.supabaseAdmin
        .from("parties")
        .update({
          archived_at: null,
          archived_by: null,
          archive_reason: null,
        })
        .eq("id", data.party_id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createCleanupPartyContacts(deps: AdminDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("party_contacts")
        .select("id, email, is_primary, linked_user_id, created_at, active")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id);
      if (error) throw new Error(error.message);
      const groups = new Map<string, any[]>();
      for (const c of (rows ?? []) as any[]) {
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
          const score = (r: any) =>
            (r.linked_user_id ? 0 : 1) * 10 + (r.is_primary ? 0 : 1) * 5 + (r.active ? 0 : 1);
          const s = score(a) - score(b);
          if (s !== 0) return s;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
        const drop = list.slice(1).map((r) => r.id);
        removed += drop.length;
        await deps.supabaseAdmin
          .from("party_contacts")
          .delete()
          .in("id", drop)
          .eq("tenant_id", data.tenant_id);
      }
      if (removed > 0) {
        await deps.supabaseAdmin.from("audit_logs").insert({
          tenant_id: data.tenant_id,
          record_type: "parties",
          record_id: data.party_id,
          action: "contacts_deduped",
          user_id: context.userId,
          new_value: { removed },
        } as never);
      }
      return { ok: true, removed };
    });
}

/**
 * Merge source party into target party. Reassigns every table registered in
 * deps.partyDocRefTables / deps.partyChildTables (see each app's
 * party-references.ts), then deletes the source row. Generic across apps —
 * a new module only needs to add its table to that app's registry, not edit
 * this function.
 */
export function createMergeParties(deps: MergePartiesDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        source_party_id: z.string().uuid(),
        target_party_id: z.string().uuid(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertCanEditVendor(deps.supabaseAdmin, deps.appCode, data.tenant_id, context.userId);
      if (data.source_party_id === data.target_party_id) {
        throw new Error("Source and target must be different");
      }

      const { data: parties, error: pErr } = await deps.supabaseAdmin
        .from("parties")
        .select("id, name_en")
        .eq("tenant_id", data.tenant_id)
        .in("id", [data.source_party_id, data.target_party_id]);
      if (pErr) throw new Error(pErr.message);
      if ((parties ?? []).length !== 2) throw new Error("Both parties must exist in this tenant");
      const source = parties!.find((p: any) => p.id === data.source_party_id)!;
      const target = parties!.find((p: any) => p.id === data.target_party_id)!;

      const counts: Record<string, number> = {};
      for (const { table: tbl, column } of deps.partyDocRefTables) {
        const { error, count } = await deps.supabaseAdmin
          .from(tbl as never)
          .update({ [column]: data.target_party_id } as never, { count: "exact" })
          .eq("tenant_id", data.tenant_id)
          .eq(column, data.source_party_id);
        if (error) throw new Error(`${tbl}: ${error.message}`);
        counts[tbl] = count ?? 0;
      }
      for (const { table: tbl, column } of deps.partyChildTables) {
        const { error, count } = await deps.supabaseAdmin
          .from(tbl as never)
          .update({ [column]: data.target_party_id } as never, { count: "exact" })
          .eq("tenant_id", data.tenant_id)
          .eq(column, data.source_party_id);
        if (error) throw new Error(`${tbl}: ${error.message}`);
        counts[tbl] = count ?? 0;
      }

      // Post-merge cleanup: dedupe party_contacts (same lower(email)) on target,
      // keeping the linked / primary / oldest row. Only meaningful if the app
      // registered party_contacts as a child table.
      if (deps.partyChildTables.some((t) => t.table === "party_contacts")) {
        const { data: tContacts } = await deps.supabaseAdmin
          .from("party_contacts")
          .select("id, email, is_primary, linked_user_id, created_at, active")
          .eq("tenant_id", data.tenant_id)
          .eq("party_id", data.target_party_id);
        const contactDupGroups = new Map<string, any[]>();
        for (const c of (tContacts ?? []) as any[]) {
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
            const score = (r: any) =>
              (r.linked_user_id ? 0 : 1) * 10 + (r.is_primary ? 0 : 1) * 5 + (r.active ? 0 : 1);
            const s = score(a) - score(b);
            if (s !== 0) return s;
            return (a.created_at ?? "").localeCompare(b.created_at ?? "");
          });
          const keepIds = [rows[0].id];
          const drop = rows.slice(1).map((r) => r.id);
          contactsMerged += drop.length;
          await deps.supabaseAdmin
            .from("party_contacts")
            .delete()
            .in("id", drop)
            .eq("tenant_id", data.tenant_id);
          await deps.supabaseAdmin
            .from("party_contacts")
            .update({ is_primary: true } as never)
            .in("id", keepIds);
        }
        counts["party_contacts_deduped"] = contactsMerged;
      }

      // Dedupe party_bank_accounts by account_number. Only meaningful if the
      // app registered party_bank_accounts as a child table.
      if (deps.partyChildTables.some((t) => t.table === "party_bank_accounts")) {
        const { data: tBanks } = await deps.supabaseAdmin
          .from("party_bank_accounts")
          .select("id, account_number, routing_number, created_at, archived_at")
          .eq("tenant_id", data.tenant_id)
          .eq("party_id", data.target_party_id);
        const bankDupGroups = new Map<string, any[]>();
        for (const b of (tBanks ?? []) as any[]) {
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
          await deps.supabaseAdmin
            .from("party_bank_accounts")
            .delete()
            .in("id", drop)
            .eq("tenant_id", data.tenant_id);
        }
        counts["party_bank_accounts_deduped"] = banksMerged;
      }

      const { error: delErr } = await deps.supabaseAdmin
        .from("parties")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.source_party_id);
      if (delErr) throw new Error(`parties: ${delErr.message}`);

      await deps.supabaseAdmin.from("audit_logs").insert({
        tenant_id: data.tenant_id,
        record_type: "parties",
        record_id: data.target_party_id,
        action: "merged",
        user_id: context.userId,
        old_value: { source_party_id: data.source_party_id, source_name: source.name_en },
        new_value: { target_party_id: data.target_party_id, target_name: target.name_en, reassigned: counts },
      } as never);

      return { ok: true, target_party_id: data.target_party_id, reassigned: counts };
    });
}
