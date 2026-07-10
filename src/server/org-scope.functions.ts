import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies every requested tenant_id is an active membership of `userId`
 * before a cross-organization query is allowed to run. No elevated role is
 * required — a user may always aggregate across organizations they already
 * belong to (unlike, say, an internal audit-log view of other users'
 * activity).
 *
 * The one restriction: combining more than one organization is only
 * available to `internal` memberships. `vendor`/`approver`/`customer`
 * portal grants are narrow, single-purpose access to someone else's
 * tenant, not a real membership in "one of my organizations" — they must
 * never be folded into a cross-org aggregate. A single-organization
 * request (tenantIds length 1) isn't restricted by portal type; it just
 * needs to be an active membership, matching the pre-existing
 * single-tenant behavior.
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
    .select("tenant_id, portal")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("tenant_id", tenantIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ tenant_id: string; portal: string | null }>;
  const active = new Set(rows.map((r) => r.tenant_id));
  if (tenantIds.some((id) => !active.has(id))) {
    throw new Error("Forbidden: one or more organizations are not an active membership");
  }

  if (tenantIds.length > 1) {
    const nonInternal = rows.filter((r) => r.portal && r.portal !== "internal");
    if (nonInternal.length > 0) {
      throw new Error("Forbidden: combining organizations is only available to internal members");
    }
  }

  return tenantIds;
}
