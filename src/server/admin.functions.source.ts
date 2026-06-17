import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email.server";

function appBaseUrl() {
  return (process.env.APP_BASE_URL || "https://books.joasuite.com").replace(/\/$/, "");
}

const APP_ROLES = [
  "owner",
  "super_admin",
  "finance_ap",
  "finance_ar",
  "finance_manager",
  "accountant",
  "approver",
  "vendor",
  "customer",
] as const;
const AppRole = z.enum(APP_ROLES);

async function assertOwnerOrAdmin(tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as string);
  const ok = roles.some((r) => ["owner", "super_admin", "finance_manager"].includes(r));
  if (!ok) throw new Error("Forbidden: admin role required");
}

async function assertCanEditVendor(tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as string);
  const ok = roles.some((r) =>
    ["owner", "super_admin", "finance_manager", "finance_ap", "accountant"].includes(r),
  );
  if (!ok) throw new Error("Forbidden: vendor edit role required");
}

async function assertTenantMember(tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not a tenant member");
}

// ---------- Tenant settings ----------
export const getTenantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: t, error } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, status, settings")
      .eq("id", data.tenant_id)
      .single();
    if (error) throw new Error(error.message);
    return t;
  });

export const updateTenantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      settings: z.record(z.string(), z.any()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const patch: { name?: string; settings?: Record<string, unknown> } = {};
    if (data.name) patch.name = data.name;
    if (data.settings) patch.settings = data.settings;
    const { data: t, error } = await supabaseAdmin
      .from("tenants")
      .update(patch as never)
      .eq("id", data.tenant_id)
      .select("id, name, settings")
      .single();

    if (error) throw new Error(error.message);
    return t;
  });

// ---------- Payment methods ----------
export const listPaymentMethods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("payment_methods")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      code: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/),
      label: z.string().min(1).max(80),
      active: z.boolean().optional(),
      sort_order: z.number().int().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const row = {
      tenant_id: data.tenant_id,
      code: data.code,
      label: data.label,
      active: data.active ?? true,
      sort_order: data.sort_order ?? 100,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("payment_methods").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("payment_methods")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ---------- Currencies ----------
export const listCurrencies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const sb = supabaseAdmin as any;
    const { data: rows, error } = await sb
      .from("currencies")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      code: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/),
      symbol: z.string().max(8).default(""),
      sort_order: z.number().int().optional(),
      active: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const sb = supabaseAdmin as any;
    const row = {
      tenant_id: data.tenant_id,
      code: data.code,
      symbol: data.symbol,
      sort_order: data.sort_order ?? 100,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await sb.from("currencies").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await sb.from("currencies").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

// ---------- Payment accounts (internal bank/cash) ----------
const PaymentAccountType = z.enum(["checking", "savings", "credit_card", "cash", "other"]);

export const listPaymentAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("payment_accounts")
      .select("id, account_name, account_type, bank_name, last4, opening_balance, current_balance, active, description")
      .eq("tenant_id", data.tenant_id)
      .order("account_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPaymentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      account_name: z.string().min(1).max(120),
      account_type: PaymentAccountType,
      bank_name: z.string().max(120).optional().nullable(),
      last4: z.string().max(8).optional().nullable(),
      opening_balance: z.number().optional(),
      description: z.string().max(500).optional().nullable(),
      active: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { id, tenant_id, ...rest } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("payment_accounts").update(rest).eq("id", id).eq("tenant_id", tenant_id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("payment_accounts")
      .insert({ tenant_id, ...rest, created_by: context.userId, active: rest.active ?? true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const setPaymentAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ tenant_id: z.string().uuid(), id: z.string().uuid(), active: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("payment_accounts")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Transaction categories ----------
export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("transaction_categories")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("type")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      type: z.enum(["income", "cogs", "expense", "asset", "liability", "equity", "other_income", "other_expense"]),
      active: z.boolean().optional(),
      sort_order: z.number().int().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const row = {
      tenant_id: data.tenant_id,
      name: data.name,
      type: data.type,
      active: data.active ?? true,
      sort_order: data.sort_order ?? 1000,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("transaction_categories").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("transaction_categories")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ---------- Tenant users / invitations ----------
export const listTenantUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: members, error } = await supabaseAdmin
      .from("tenant_users")
      .select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at")
      .eq("tenant_id", data.tenant_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", data.tenant_id);
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = byUser.get(r.user_id as string) ?? [];
      arr.push(r.role as string);
      byUser.set(r.user_id as string, arr);
    });
    return (members ?? []).map((m) => ({ ...m, roles: byUser.get(m.user_id as string) ?? [] }));
  });

export const getTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("tenant_users")
      .select("id, user_id, portal, status, display_name, email, position, invited_at, joined_at")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    return { ...m, roles: (roles ?? []).map((r) => r.role as string) };
  });

export const updateTenantUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      display_name: z.string().min(1).max(120),
      position: z.string().max(120).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("tenant_users")
      .update({ display_name: data.display_name, position: data.position ?? null })
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


async function findOrInviteUser(email: string, displayName?: string) {
  // Try find existing user
  const { data: existing, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (lookupErr) throw new Error(lookupErr.message);
  const match = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (match) {
    // Existing user: do NOT send any email. The caller will simply add them
    // to the workspace; they already have credentials.
    return {
      user: match,
      created: false,
      alreadyExisted: true,
      actionLink: null as string | null,
    };
  }

  // New user: use Supabase "invite" link which creates the user WITHOUT a password
  // and forces them to set one on first visit (redirected to /reset-password).
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${appBaseUrl()}/reset-password`,
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

export const inviteTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      await assertCanEditVendor(data.tenant_id, context.userId);
    } else {
      await assertOwnerOrAdmin(data.tenant_id, context.userId);
    }
    const invited = await findOrInviteUser(data.email, data.display_name);

    // Look up the tenant name for the invitation email
    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", data.tenant_id)
      .single();
    const tenantName = tenantRow?.name ?? "your workspace";

    // Detect if they were already a member of THIS workspace
    const { data: existingMembership } = await supabaseAdmin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", invited.user.id)
      .maybeSingle();
    const alreadyMember = !!existingMembership;

    // Upsert tenant membership
    const { error: muErr } = await supabaseAdmin
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

    // Assign roles
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        tenant_id: data.tenant_id,
        user_id: invited.user.id,
        role: r,
      }));
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(rows, { onConflict: "tenant_id,user_id,role,app_code" });
      if (rErr) throw new Error(rErr.message);
    }

    // If vendor portal and party_id given, link
    if (data.party_id) {
      const { error: pErr } = await supabaseAdmin
        .from("parties")
        .update({ linked_user_id: invited.user.id })
        .eq("id", data.party_id)
        .eq("tenant_id", data.tenant_id);
      if (pErr) throw new Error(pErr.message);
    }

    // Always send an invitation email. For brand-new auth users we already
    // have an invite action link. For existing auth users we generate a
    // fresh link — `invite` if they never confirmed (no password set yet),
    // otherwise `magiclink` so they can sign in directly.
    let actionLink: string | null = invited.actionLink;
    if (!invited.created) {
      const confirmed = !!(invited.user as { email_confirmed_at?: string | null })
        .email_confirmed_at;
      const { data: link } = await supabaseAdmin.auth.admin.generateLink({
        type: confirmed ? "magiclink" : "invite",
        email: data.email,
        options: { redirectTo: `${appBaseUrl()}/reset-password` },
      });
      actionLink = link?.properties?.action_link ?? null;
    }
    const emailResult = await sendInviteEmail({
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

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("tenant_users")
      .select("email, display_name")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id)
      .single();
    if (error) throw new Error(error.message);
    if (!m.email) throw new Error("User has no email on file");

    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("name")
      .eq("id", data.tenant_id)
      .single();
    const tenantName = tenantRow?.name ?? "your workspace";

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.email,
      options: { redirectTo: `${appBaseUrl()}/reset-password` },
    });
    if (linkErr) throw new Error(linkErr.message);

    const result = await sendInviteEmail({
      email: m.email,
      display_name: m.display_name ?? undefined,
      created: false,
      actionLink: link?.properties?.action_link ?? null,
      tenantName,
    });
    return { ok: true, email: result };
  });

export const sendPasswordResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ tenant_id: z.string().uuid(), user_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { data: m, error } = await supabaseAdmin
      .from("tenant_users")
      .select("email, display_name")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id)
      .single();
    if (error) throw new Error(error.message);
    if (!m.email) throw new Error("User has no email on file");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: m.email,
      options: { redirectTo: `${appBaseUrl()}/reset-password` },
    });
    if (linkErr) throw new Error(linkErr.message);

    const url = link?.properties?.action_link ?? "";
    const subject = "Reset your JoaBooks password";
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
        <h2 style="margin:0 0 12px 0">JoaBooks</h2>
        <p>Hi${m.display_name ? " " + m.display_name : ""},</p>
        <p>A password reset was requested for your JoaBooks account.</p>
        <p style="margin:24px 0">
          <a href="${url}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Reset password</a>
        </p>
        <p style="color:#677084;font-size:13px">If you didn't expect this, you can ignore this email.</p>
      </div>`;
    const result = await sendEmail({ to: m.email, subject, html });
    return { ok: true, email: result };
  });

async function sendInviteEmail(opts: {
  email: string;
  display_name?: string;
  created: boolean;
  actionLink: string | null;
  tenantName: string;
  vendorName?: string;
}) {
  const subject = opts.created
    ? `You've been invited to ${opts.tenantName} on JoaBooks`
    : `You've been added to ${opts.tenantName} on JoaBooks`;
  const link = opts.actionLink ?? "";
  const safeName = String(opts.tenantName).replace(/[<>&]/g, "");
  const safeVendorName = opts.vendorName ? String(opts.vendorName).replace(/[<>&]/g, "") : "";
  const signInUrl = (process.env.PUBLIC_APP_URL || "https://books.joasuite.com").replace(/\/$/, "") + "/signin";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#1a1f36">
      <h2 style="margin:0 0 12px 0">JoaBooks</h2>
      <p>Hi${opts.display_name ? " " + opts.display_name : ""},</p>
      <p>You have been ${opts.created ? "invited" : "added"} to the <strong>${safeName}</strong> workspace on JoaBooks.</p>
      ${safeVendorName ? `<p>You have been invited as a contact for <strong>${safeVendorName}</strong> and can access the vendor portal to view payment requests and submit new ones.</p>` : ""}
      ${
        link
          ? `<p style="margin:24px 0"><a href="${link}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${opts.created ? "Set password &amp; sign in" : "Sign in to " + safeName}</a></p>
             <p style="color:#677084;font-size:13px">${opts.created ? "This link will let you create your password and sign in to" : "This one-time link signs you in to"} <strong>${safeName}</strong>. It expires soon, so please use it right away.</p>`
          : `<p style="margin:24px 0"><a href="${signInUrl}" style="background:#2647c2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Sign in</a></p>
             <p style="color:#677084;font-size:13px">Sign in with your existing JoaBooks account to access <strong>${safeName}</strong>.</p>`
      }
      <p style="color:#677084;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
    </div>`;
  return sendEmail({ to: opts.email, subject, html });
}


// DEPRECATED: kept for backward compatibility — applies roles to ALL of the user's
// existing app_codes in this tenant. Prefer setUserAppRoles in account.functions.ts.
export const updateTenantUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      roles: z.array(AppRole),
      app_code: z.string().min(1).max(64).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const appCode = data.app_code ?? "joabooks";
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id)
      .eq("app_code", appCode);
    if (delErr) throw new Error(delErr.message);
    if (data.roles.length > 0) {
      const rows = data.roles.map((r) => ({
        tenant_id: data.tenant_id,
        user_id: data.user_id,
        role: r,
        app_code: appCode,
      }));
      const { error } = await supabaseAdmin.from("user_roles").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setTenantUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      user_id: z.string().uuid(),
      status: z.enum(["active", "invited", "suspended"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertOwnerOrAdmin(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("tenant_users")
      .update({ status: data.status })
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Remove a user from this workspace only. Owner/super_admin only.
// Keeps audit_logs / approvals / etc. intact (no FK to auth.users); the
// user_name snapshot already stored on those rows continues to display.
// Does NOT delete the auth.users account or other tenant memberships.
export const removeTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    // Caller must be owner or super_admin in this tenant.
    const { data: callerRoles, error: crErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", callerId);
    if (crErr) throw new Error(crErr.message);
    const callerSet = new Set((callerRoles ?? []).map((r) => r.role as string));
    if (!callerSet.has("owner") && !callerSet.has("super_admin")) {
      throw new Error("Forbidden: owner or super_admin required");
    }
    // Target must not be an owner (transfer ownership first).
    const { data: targetRoles, error: trErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    if (trErr) throw new Error(trErr.message);
    if ((targetRoles ?? []).some((r) => r.role === "owner")) {
      throw new Error("Cannot remove an owner. Transfer ownership first.");
    }
    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    if (rolesErr) throw new Error(rolesErr.message);
    const { error: memErr } = await supabaseAdmin
      .from("tenant_users")
      .delete()
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id);
    if (memErr) throw new Error(memErr.message);
    return { ok: true };
  });


// ---------- Parties (vendors / customers) ----------
export const listParties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      kind: z.enum(["all", "vendor", "customer"]).default("all"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    let q = supabaseAdmin
      .from("parties")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("name_en");
    if (data.kind === "vendor") q = q.eq("is_vendor", true);
    if (data.kind === "customer") q = q.eq("is_customer", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Enrich with sign-in status so the UI can distinguish
    // "Invited" (linked_user_id set but never signed in) from
    // "Linked" (the user has actually signed in at least once).
    const linkedIds = Array.from(
      new Set(list.map((p) => p.linked_user_id).filter((x): x is string => !!x)),
    );
    const signedInMap = new Map<string, boolean>();
    if (linkedIds.length > 0) {
      const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      for (const u of usersPage?.users ?? []) {
        if (linkedIds.includes(u.id)) {
          signedInMap.set(u.id, !!u.last_sign_in_at);
        }
      }
    }
    return list.map((p) => ({
      ...p,
      linked_signed_in: p.linked_user_id
        ? signedInMap.get(p.linked_user_id) ?? false
        : false,
    }));
  });

export const upsertParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    await assertCanEditVendor(data.tenant_id, context.userId);
    const { id, ...rest } = data;
    const row = {
      ...rest,
      contact_email: rest.contact_email === "" ? null : rest.contact_email,
    };
    if (id) {
      const { error } = await supabaseAdmin.from("parties").update(row).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("parties")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const setPartyW9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      attachment_id: z.string().uuid().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("parties")
      .update({ w9_attachment_id: data.attachment_id })
      .eq("id", data.party_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("parties")
      .delete()
      .eq("id", data.party_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("parties")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .eq("id", data.party_id)
      .single();
    if (error) throw new Error(error.message);
    const [{ data: banks }, { data: contacts }] = await Promise.all([
      supabaseAdmin
        .from("party_bank_accounts")
        .select("*")
        .eq("party_id", data.party_id)
        .order("archived_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
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

// ---------- Party contacts (multiple per vendor, portal-invitable) ----------
export const listPartyContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("party_contacts")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .eq("party_id", data.party_id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPartyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    await assertCanEditVendor(data.tenant_id, context.userId);
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
      const { error } = await supabaseAdmin
        .from("party_contacts")
        .update(row)
        .eq("id", data.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin
      .from("party_contacts")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deletePartyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("party_contacts")
      .delete()
      .eq("id", data.contact_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const invitePartyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
    const { data: c, error: ce } = await supabaseAdmin
      .from("party_contacts")
      .select("id, name, email, party_id, tenant_id")
      .eq("id", data.contact_id)
      .eq("tenant_id", data.tenant_id)
      .single();
    if (ce) throw new Error(ce.message);
    if (!c.email) throw new Error("Contact has no email");

    const invited = await findOrInviteUser(c.email, c.name);

    const { data: tenantRow } = await supabaseAdmin
      .from("tenants").select("name").eq("id", data.tenant_id).single();
    const tenantName = tenantRow?.name ?? "your workspace";

    // Fetch vendor name
    const { data: partyRow } = await supabaseAdmin
      .from("parties").select("name_en").eq("id", c.party_id).single();
    const vendorName = partyRow?.name_en ?? "";

    // Ensure tenant_users membership as vendor portal
    await supabaseAdmin
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

    // Vendor role
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { tenant_id: data.tenant_id, user_id: invited.user.id, role: "vendor" },
        { onConflict: "tenant_id,user_id,role,app_code" },
      );

    // Link contact -> user
    await supabaseAdmin
      .from("party_contacts")
      .update({ linked_user_id: invited.user.id, invited_at: new Date().toISOString() })
      .eq("id", c.id);

    // Always notify the contact — newly-created users get a set-password link,
    // existing users get a "you've been added to another workspace" notice.
    const emailResult = await sendInviteEmail({
      email: c.email,
      display_name: c.name,
      created: invited.created,
      actionLink: invited.actionLink,
      tenantName,
      vendorName,
    });
    return { ok: true, user_id: invited.user.id, email: emailResult };
  });

export const revokePartyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      contact_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
    const { error } = await supabaseAdmin
      .from("party_contacts")
      .update({ linked_user_id: null, invited_at: null })
      .eq("id", data.contact_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getVendorActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const lim = data.limit;
    const [prs, bills, expenses, txns] = await Promise.all([
      supabaseAdmin
        .from("payment_requests")
        .select("id,request_no,request_date,amount_usd,status,currency")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .order("request_date", { ascending: false })
        .limit(lim),
      supabaseAdmin
        .from("bills")
        .select("id,bill_no,bill_date,due_date,amount_usd,status")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .order("bill_date", { ascending: false })
        .limit(lim),
      supabaseAdmin
        .from("expenses")
        .select("id,expense_no,expense_date,amount_usd,status")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .order("expense_date", { ascending: false })
        .limit(lim),
      supabaseAdmin
        .from("transactions")
        .select("id,txn_no,txn_date,amount,direction,status,description")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .order("txn_date", { ascending: false })
        .limit(lim),
    ]);
    const openStatuses = new Set(["draft", "submitted", "in_review", "approved", "scheduled", "partial"]);
    const sumOpen = (rows: Array<{ status: string; amount_usd: number }> | null | undefined) =>
      (rows ?? []).filter((r) => openStatuses.has(String(r.status))).reduce((s, r) => s + Number(r.amount_usd || 0), 0);
    return {
      payment_requests: prs.data ?? [],
      bills: bills.data ?? [],
      expenses: expenses.data ?? [],
      transactions: txns.data ?? [],
      summary: {
        open_bills_total: sumOpen(bills.data as Array<{ status: string; amount_usd: number }> | null),
        open_prs_total: sumOpen(prs.data as Array<{ status: string; amount_usd: number }> | null),
        open_expenses_total: sumOpen(expenses.data as Array<{ status: string; amount_usd: number }> | null),
        bills_count: (bills.data ?? []).length,
        prs_count: (prs.data ?? []).length,
        expenses_count: (expenses.data ?? []).length,
        txns_count: (txns.data ?? []).length,
      },
    };
  });

/**
 * List vendors (parties) the current user has portal access to in the given
 * tenant — either as the main linked user on parties.linked_user_id, OR as
 * an active linked contact in party_contacts. Used by the vendor portal so a
 * contact who is invited to multiple vendors can switch between them.
 */
export const listMyAccessibleVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ tenant_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenantMember(data.tenant_id, context.userId);
    const [{ data: direct, error: e1 }, { data: viaContacts, error: e2 }] = await Promise.all([
      supabaseAdmin
        .from("parties")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .eq("linked_user_id", context.userId)
        .eq("active", true),
      supabaseAdmin
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
    const { data: parties, error } = await supabaseAdmin
      .from("parties")
      .select("id, name_en, nick_name")
      .in("id", Array.from(ids))
      .eq("active", true)
      .order("name_en");
    if (error) throw new Error(error.message);
    return parties ?? [];
  });

/**
 * Returns the set of tenant_ids (from the user's active vendor memberships)
 * where the user actually has at least one accessible vendor (linked party
 * or active party_contact). Used by the vendor portal workspace switcher to
 * hide stale tenant memberships with no vendor records.
 */
export const listMyVendorTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const [{ data: direct }, { data: viaContacts }] = await Promise.all([
      supabaseAdmin
        .from("parties")
        .select("tenant_id")
        .eq("linked_user_id", userId)
        .eq("active", true),
      supabaseAdmin
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

export const upsertPartyBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      party_id: z.string().uuid(),
      bank: BankAccountInput,
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
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
      // If the existing bank account is referenced by any payment request,
      // archive it and insert a new row so prior PRs keep their original snapshot.
      const { count: refCount } = await supabaseAdmin
        .from("payment_requests")
        .select("id", { head: true, count: "exact" })
        .eq("tenant_id", data.tenant_id)
        .eq("party_bank_account_id", data.bank.id);
      if ((refCount ?? 0) > 0) {
        const { data: newRow, error: insErr } = await supabaseAdmin
          .from("party_bank_accounts")
          .insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        const { error: archErr } = await supabaseAdmin
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
      const { error } = await supabaseAdmin
        .from("party_bank_accounts")
        .update(patch as never)
        .eq("id", data.bank.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { id: data.bank.id, archived_previous: false };
    }
    const { data: row, error } = await supabaseAdmin
      .from("party_bank_accounts")
      .insert({ tenant_id: data.tenant_id, party_id: data.party_id, ...patch })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, archived_previous: false };
  });

export const deletePartyBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      tenant_id: z.string().uuid(),
      bank_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditVendor(data.tenant_id, context.userId);
    // If referenced by any PR, archive instead of deleting so historical PRs keep their bank snapshot.
    const { count: refCount } = await supabaseAdmin
      .from("payment_requests")
      .select("id", { head: true, count: "exact" })
      .eq("tenant_id", data.tenant_id)
      .eq("party_bank_account_id", data.bank_id);
    if ((refCount ?? 0) > 0) {
      const { error } = await supabaseAdmin
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
    const { error } = await supabaseAdmin
      .from("party_bank_accounts")
      .delete()
      .eq("id", data.bank_id)
      .eq("tenant_id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true, archived: false };
  });
