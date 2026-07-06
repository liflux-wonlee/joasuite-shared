import { useAuth } from "@/lib/auth-context";

/**
 * useIsTenantAdmin — **UI HINT ONLY**.
 *
 * Returns whether the current membership claims an admin-tier role
 * (`owner` or `super_admin`) in the active tenant. Use this ONLY to toggle
 * UI affordances (disable buttons, hide menu items, show/hide forms).
 *
 * 🚨 NEVER use this as a security boundary. The browser-side `roles` array
 * is user-controllable and could be tampered with at runtime.
 *
 * Every mutation MUST be implemented as a `createServerFn` that re-checks
 * authorization on the server before any write — typically via
 * `assertOwnerOrAdmin(tenantId, userId)` (see `src/lib/admin.functions.ts`)
 * or `assertOwner(supabase, tenantId, userId)` (see `src/lib/suite.functions.ts`).
 *
 * See `docs/security/server-mutation-checklist.md` for the full rule set.
 */
export function useIsTenantAdmin(): boolean {
  const { currentMembership } = useAuth();
  const roles: string[] = currentMembership?.roles ?? [];
  return roles.some((r: string) => r === "owner" || r === "super_admin");
}
