import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies every requested tenant_id is an active membership of `userId`
 * before a cross-organization query is allowed to run. No elevated role is
 * required — a user may always aggregate across organizations they already
 * belong to (unlike, say, an internal audit-log view of other users'
 * activity). Throws if any requested id is not an active membership, so a
 * client can never smuggle in an organization the caller doesn't belong to.
 *
 * A plain helper rather than a `createServerFn` factory: it has nothing
 * app-specific to inject (no email sender, no app code) and is meant to be
 * called from inside another handler that already has an authenticated
 * `supabase` client and `userId` from its own middleware.
 */
export async function resolveScopedTenantIds(
  supabase: SupabaseClient,
  userId: string,
  tenantIds: string[],
): Promise<string[]> {
  if (tenantIds.length === 0) throw new Error("At least one organization is required");
  const { data, error } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("tenant_id", tenantIds);
  if (error) throw new Error(error.message);
  const active = new Set((data ?? []).map((r: any) => r.tenant_id as string));
  const verified = tenantIds.filter((id) => active.has(id));
  if (verified.length !== tenantIds.length) {
    throw new Error("Forbidden: one or more organizations are not an active membership");
  }
  return verified;
}

const SUITE_WIDE_ORG_SCOPE_ROLES = ["owner", "super_admin"];

/**
 * Combining more than one organization into a single view is an elevated
 * action, gated to `owner`/`super_admin` (suite-wide) plus whatever
 * app-specific roles the caller passes in `extraRoles` (e.g. JoaBooks'
 * `admin`/`finance_manager`). A single-organization request (tenantIds
 * length 1) never needs this — every member can already see their own
 * organization's data.
 *
 * This mirrors the eligibility check `OrgScopeToggle` does client-side
 * (see components/OrgScopeToggle.tsx) — that copy is a UI hint only, this
 * is the real enforcement.
 */
export async function assertOrgScopeAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantIds: string[],
  extraRoles: string[] = [],
): Promise<void> {
  if (tenantIds.length <= 1) return;
  const allowedRoles = [...SUITE_WIDE_ORG_SCOPE_ROLES, ...extraRoles];
  const { data, error } = await supabase
    .from("user_roles")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .in("tenant_id", tenantIds)
    .in("role", allowedRoles);
  if (error) throw new Error(error.message);
  const covered = new Set((data ?? []).map((r: any) => r.tenant_id as string));
  const missing = tenantIds.filter((id) => !covered.has(id));
  if (missing.length > 0) {
    throw new Error(
      "Forbidden: combining multiple organizations requires an elevated role in each selected organization",
    );
  }
}
