/**
 * Server-function factories for @joasuite/shared-ui.
 *
 * Why factories instead of plain `createServerFn` exports?
 *   - Each app supplies its own Supabase middleware (`requireSupabaseAuth`)
 *     because the middleware import path differs per app and is wired into
 *     the app's `src/start.ts` global middleware stack.
 *   - Each app may want to extend the validators or wrap with logging.
 *
 * Usage in the consuming app (e.g. JoaBooks `src/lib/suite.functions.ts`):
 *
 *   import { createListSuiteApps } from "@joasuite/shared-ui/server";
 *   import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
 *
 *   export const listSuiteApps = createListSuiteApps({ requireSupabaseAuth });
 *
 * Then the app re-exports the bound server fns and passes them into
 * <JoaSuiteProvider value={{ fns: { listSuiteApps, ... } }}>.
 *
 * --------------------------------------------------------------------
 * IMPLEMENTATION NOTE — TO BE COMPLETED BEFORE v0.1.0 PUBLISH:
 * --------------------------------------------------------------------
 * The full factory bodies should be ported from JoaBooks. The current
 * source files are:
 *
 *   - src/lib/suite.functions.ts          → createListSuiteApps,
 *                                            createSubscribeApp,
 *                                            createCancelApp
 *   - src/lib/suite-home.functions.ts     → createGetSuiteHome,
 *                                            createSetAppUrl
 *   - src/lib/notifications.functions.ts  → createListNotifications,
 *                                            createMarkNotificationRead,
 *                                            createMarkAllNotificationsRead
 *   - src/lib/account.functions.ts        → createListManageableUsers,
 *                                            createInviteUserToWorkspaces,
 *                                            createSetUserAppRoles,
 *                                            createAccountResendInvitation,
 *                                            createAccountSendPasswordReset,
 *                                            createAccountUpdateUserProfile
 *   - src/lib/admin.functions.ts          → createRemoveTenantUser
 *
 * For each: wrap the existing body in
 *
 *   export function createXxx(deps: { requireSupabaseAuth: MiddlewareType }) {
 *     return createServerFn({ method: "POST" })
 *       .middleware([deps.requireSupabaseAuth])
 *       .inputValidator(...)
 *       .handler(...);
 *   }
 *
 * Keep the handler bodies byte-for-byte identical to the JoaBooks
 * source so behavior is preserved across all apps.
 */

export type { AppCode } from "../constants";

// Placeholder so the entry point compiles. Replace with real factories.
export const __SERVER_FACTORIES_NOT_YET_IMPLEMENTED__ = true;
