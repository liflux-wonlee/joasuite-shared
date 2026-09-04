/**
 * JoaSuite Subscription Account + Multi-Organization module — plain
 * business-logic functions, deliberately NOT wrapped in `createServerFn()`
 * here.
 *
 * Same root cause and fix as team.server.ts/account.server.ts/
 * billing.server.ts (see those files' doc comments for the full history):
 * a `createServerFn()` call living inside this package's pre-compiled dist
 * can lose context.supabase/context.userId at the handler, because it's
 * this package's own build step processing the call rather than each
 * consuming app's TanStack Start/router-plugin Vite build. So the split is
 * the same as those files: this file owns the actual Supabase queries and
 * authorization logic; each consuming app's own
 * `subscription-account.functions.ts` supplies a thin
 * `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 * .inputValidator(...).handler(({data, context}) => xServer(data, context
 * as never, deps))` wrapper living in its own source, so the
 * createServerFn() boundary is always app-local.
 *
 * Architecture reminder (see the reviewed plan in joabooks/CLAUDE.md's
 * "JoaSuite Subscription Account + Multi-Organization Architecture" entry
 * for the full writeup): `tenant` stays = Organization everywhere else in
 * the schema. A Subscription Account is a NEW parent commercial entity
 * that owns 1..N Organizations. Account ownership (subscription_account_
 * members) and Organization ownership (tenant_users/user_roles) are
 * DELIBERATELY SEPARATE authorization domains — never conflate them.
 * Tenant-level RLS is completely untouched by any of this; Account
 * membership authorizes Account-level operations only, never a bypass of
 * an Organization's own tenant_users-gated business data.
 */

export type AccountAuthContext = { supabase: any; userId: string };
export type SubscriptionAccountDeps = { supabaseAdmin: any };

// The canonical capacity shape every UI surface must consume — never
// recompute "limit - count" independently in more than one place (see
// resolve_organization_capacity(), the single SQL source of truth this
// wraps).
export type OrganizationCapacity = {
  planCode: string;
  baseLimit: number;
  extraSlots: number;
  effectiveLimit: number;
  used: number;
  remaining: number;
  overLimit: boolean;
  canCreate: boolean;
};

function toCapacity(row: any): OrganizationCapacity {
  return {
    planCode: row.plan_code,
    baseLimit: Number(row.base_limit),
    extraSlots: Number(row.extra_slots),
    effectiveLimit: Number(row.effective_limit),
    used: Number(row.used),
    remaining: Number(row.remaining),
    overLimit: !!row.over_limit,
    canCreate: !!row.can_create,
  };
}

// Stable error codes (see ACCOUNT_ERROR_CODES) rather than matching UI on
// arbitrary Postgres message strings — resolve_organization_capacity() and
// create_organization_for_account() raise these as the message prefix.
export const ACCOUNT_ERROR_CODES = [
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_PERMISSION_DENIED",
  "ORGANIZATION_LIMIT_REACHED",
] as const;
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

export function parseAccountErrorCode(message: string): AccountErrorCode | null {
  const found = ACCOUNT_ERROR_CODES.find((c) => message.startsWith(c));
  return found ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Listing / lookups
// ──────────────────────────────────────────────────────────────────────────────

export type ListMySubscriptionAccountsInput = Record<string, never>;

export async function listMySubscriptionAccountsServer(
  _input: ListMySubscriptionAccountsInput,
  context: AccountAuthContext,
) {
  // RLS on subscription_accounts already scopes this to accounts the
  // caller is an active member of (is_account_member()) — no extra filter
  // needed here.
  const { data: accounts, error } = await context.supabase
    .from("subscription_accounts")
    .select("id, name, status, created_at");
  if (error) throw new Error(error.message);

  const ids = (accounts ?? []).map((a: any) => a.id);
  if (ids.length === 0) return [];

  const { data: myMemberships, error: mErr } = await context.supabase
    .from("subscription_account_members")
    .select("account_id, role")
    .in("account_id", ids)
    .eq("user_id", context.userId)
    .eq("status", "active");
  if (mErr) throw new Error(mErr.message);
  const roleByAccount = new Map((myMemberships ?? []).map((m: any) => [m.account_id, m.role]));

  return (accounts ?? []).map((a: any) => ({ ...a, my_role: roleByAccount.get(a.id) ?? null }));
}

export type GetCurrentSubscriptionAccountInput = { tenant_id: string };

// Resolves "which Account does this Organization belong to" — the usual
// entry point from an app's existing tenant context (currentTenantId) into
// the new Account layer, since most users have exactly 1 Account + 1
// Organization and should never need to think about the distinction.
export async function getCurrentSubscriptionAccountServer(
  input: GetCurrentSubscriptionAccountInput,
  context: AccountAuthContext,
) {
  const { data: link, error } = await context.supabase
    .from("subscription_account_organizations")
    .select("account_id, subscription_accounts(id, name, status)")
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!link) return null;

  const { data: membership } = await context.supabase
    .from("subscription_account_members")
    .select("role")
    .eq("account_id", link.account_id)
    .eq("user_id", context.userId)
    .eq("status", "active")
    .maybeSingle();

  return { account: (link as any).subscription_accounts, my_role: membership?.role ?? null };
}

export type GetAccountOrganizationsInput = { account_id: string };

// Account-level roster of every Organization under this Account, including
// ones the caller isn't personally a tenant_users member of (e.g. "You are
// Owner" vs. someone else's Organization under the same Account) — a
// deliberate, narrow use of supabaseAdmin for display fields ONLY (tenant
// name/slug/status), never full business data, and only after the caller's
// Account membership is already proven by subscription_account_
// organizations' own RLS (is_account_member()) on the first query below.
// See this file's header comment: Account membership never bypasses a
// tenant's own RLS for anything beyond this narrow display join.
export async function getAccountOrganizationsServer(
  input: GetAccountOrganizationsInput,
  context: AccountAuthContext,
  deps: SubscriptionAccountDeps,
) {
  const { data: links, error } = await context.supabase
    .from("subscription_account_organizations")
    .select("id, tenant_id, status, created_at, archived_at")
    .eq("account_id", input.account_id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!links?.length) return [];

  const tenantIds = links.map((l: any) => l.tenant_id);
  const { data: tenants, error: tErr } = await deps.supabaseAdmin
    .from("tenants")
    .select("id, name, slug")
    .in("id", tenantIds);
  if (tErr) throw new Error(tErr.message);
  const tenantById = new Map<string, { id: string; name: string; slug: string }>(
    (tenants ?? []).map((t: any) => [t.id, t]),
  );

  const { data: myTenantRoles } = await deps.supabaseAdmin
    .from("user_roles")
    .select("tenant_id, role")
    .eq("user_id", context.userId)
    .in("tenant_id", tenantIds);
  const rolesByTenant = new Map<string, string[]>();
  for (const r of (myTenantRoles ?? []) as any[]) {
    const arr = rolesByTenant.get(r.tenant_id) ?? [];
    arr.push(r.role);
    rolesByTenant.set(r.tenant_id, arr);
  }

  return links.map((l: any) => ({
    link_id: l.id,
    tenant_id: l.tenant_id,
    tenant_name: tenantById.get(l.tenant_id)?.name ?? null,
    tenant_slug: tenantById.get(l.tenant_id)?.slug ?? null,
    status: l.status,
    created_at: l.created_at,
    archived_at: l.archived_at,
    my_roles: rolesByTenant.get(l.tenant_id) ?? [],
    is_member: (rolesByTenant.get(l.tenant_id) ?? []).length > 0,
  }));
}

export type GetOrganizationCapacityInput = { account_id: string; app_code: string };

export async function getOrganizationCapacityServer(
  input: GetOrganizationCapacityInput,
  context: AccountAuthContext,
): Promise<OrganizationCapacity> {
  const { data, error } = await context.supabase.rpc("resolve_organization_capacity", {
    _account_id: input.account_id,
    _app_code: input.app_code,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("ACCOUNT_NOT_FOUND: capacity could not be resolved");
  return toCapacity(row);
}

export type GetAccountMembersInput = { account_id: string };

export async function getAccountMembersServer(input: GetAccountMembersInput, context: AccountAuthContext) {
  // RLS already scopes this to the caller's own Account membership.
  const { data: rows, error } = await context.supabase
    .from("subscription_account_members")
    .select("id, user_id, role, status, created_at")
    .eq("account_id", input.account_id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return rows ?? [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

export type CreateOrganizationForAccountInput = {
  account_id: string | null;
  name: string;
  slug: string;
  display_name?: string | null;
  email?: string | null;
  app_code: string;
  account_name?: string | null;
};

// The single authoritative, quota-enforced Organization creation path —
// used identically by first-time onboarding, adding a subsequent
// Organization from Account > Organizations, and the Organization switcher
// shortcut. account_id: null bootstraps a brand-new Account for the caller
// (true first-time signup); non-null adds to an existing Account, quota-
// checked against its current plan. See create_organization_for_account()
// for the actual atomic implementation (race-safe via a row lock on
// subscription_accounts, not a naive count-then-insert).
export async function createOrganizationForAccountServer(
  input: CreateOrganizationForAccountInput,
  context: AccountAuthContext,
) {
  const { data, error } = await context.supabase.rpc("create_organization_for_account", {
    _account_id: input.account_id,
    _name: input.name,
    _slug: input.slug,
    _display_name: input.display_name ?? null,
    _email: input.email ?? null,
    _app_code: input.app_code,
    _account_name: input.account_name ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    tenant: { id: row.tenant_id, name: row.tenant_name, slug: row.tenant_slug },
    account_id: row.account_id,
  };
}
