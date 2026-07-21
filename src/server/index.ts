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

export { resolveScopedTenantIds } from "./org-scope.functions";

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
  createListTeamMembers,
  createGetTeamMember,
  createUpsertTeamMember,
  type TeamDeps,
} from "./team.functions";

export {
  createListDepartmentsAndPositions,
  createCreateDepartment,
  createUpdateDepartment,
  createDeleteDepartment,
  createCreatePosition,
  createUpdatePosition,
  createDeletePosition,
  createGetOrgChartTree,
  MAX_DEPARTMENT_DEPTH,
  type OrgStructureDeps,
  type OrgChartDepartment,
  type OrgChartPosition,
  type OrgChartPerson,
} from "./org-structure.functions";

export {
  createGetTenantSettings,
  createUpdateTenantSettings,
  createListTenantUsers,
  createGetTenantUser,
  createUpdateTenantUserProfile,
  createInviteTenantUser,
  createHasEverHadMembership,
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

export {
  createCanManageBillingFn,
  createGetBillingOverview,
  createUpdateBillingCustomer,
  createListBillingPlans,
  createChangeSubscriptionPlan,
  createCancelSubscription,
  createListBillingInvoices,
  createGetBillingInvoice,
  createRetryInvoicePayment,
  createSeedSampleBillingInvoices,
  createListBillingPaymentMethods,
  createAddMockPaymentMethod,
  createSetDefaultPaymentMethod,
  createRemovePaymentMethod,
  createStartTrial,
  createReactivateSubscription,
  createAddAppSubscription,
  createRemoveAppSubscription,
  createListAvailablePromotions,
  createListTenantDiscounts,
  createRedeemPromoCode,
  createRemoveTenantDiscount,
  createGetReferralProgram,
  createAddMockReferral,
  createUpdateReferralStatus,
  createGetTenantUsage,
  createListActiveBundleRules,
  APP_CODES as BILLING_APP_CODES,
  PLAN_CODES as BILLING_PLAN_CODES,
  INTERVALS as BILLING_INTERVALS,
  type BillingDeps,
  type AppCode as BillingAppCode,
  type PlanCode as BillingPlanCode,
  type BillingInterval,
} from "./billing.functions";
