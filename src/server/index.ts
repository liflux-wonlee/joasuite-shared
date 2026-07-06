/**
 * Server-function factories for @joasuite/shared-ui.
 *
 * Why factories instead of plain `createServerFn` exports?
 *   - Each app supplies its own Supabase middleware (`requireSupabaseAuth`)
 *     and admin client because those import paths differ per app.
 *   - Each app supplies its own app identity (appCode/appName/appBaseUrl) and
 *     email sender, so transactional copy and fallback URLs stay correct
 *     per app instead of leaking "JoaBooks"/books.joasuite.com everywhere.
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
 * mergeParties additionally needs partyDocRefTables/partyChildTables — see
 * each app's own `party-references.ts` (JoaBooks: src/lib/party-references.ts).
 */

export type { AppCode } from "../constants";

export {
  createListSuiteApps,
  createSubscribeApp,
  createCancelApp,
  type AppCatalogEntry,
  type TenantAppRow,
} from "./suite.functions";

export { createGetSuiteHome, createSetAppUrl, type SuiteHomeData } from "./suite-home.functions";

export {
  createListNotifications,
  createMarkNotificationRead,
  createMarkAllNotificationsRead,
} from "./notifications.functions";

export {
  createListManageableTenants,
  createListManageableUsers,
  createInviteUserToWorkspaces,
  createSetUserAppRoles,
  createAccountResendInvitation,
  createAccountSendPasswordReset,
  createAccountUpdateUserProfile,
  createGetMyProfile,
  createUpdateMyTimezone,
  createUpdateMyDefaultTenant,
  type AccountDeps,
} from "./account.functions";

export {
  createGetTenantSettings,
  createUpdateTenantSettings,
  createListTenantUsers,
  createGetTenantUser,
  createUpdateTenantUserProfile,
  createInviteTenantUser,
  createResendInvitation,
  createSendPasswordResetLink,
  createUpdateTenantUserRoles,
  createSetTenantUserStatus,
  createRemoveTenantUser,
  createListParties,
  createUpsertParty,
  createDeleteParty,
  createGetParty,
  createListPartyContacts,
  createUpsertPartyContact,
  createDeletePartyContact,
  createInvitePartyContact,
  createRevokePartyContact,
  createListMyAccessibleVendors,
  createListMyVendorTenants,
  createUpsertPartyBankAccount,
  createDeletePartyBankAccount,
  createArchiveParty,
  createUnarchiveParty,
  createCleanupPartyContacts,
  createMergeParties,
  type AdminDeps,
  type MergePartiesDeps,
  type PartyRefTable,
} from "./admin.functions";
