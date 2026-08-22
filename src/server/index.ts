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
 *
 * Exception — team.server.ts (Team Members + Departments/Positions/OrgChart)
 * and account.server.ts (Users-page tenant/user management + self-profile)
 * export plain business-logic functions, NOT createServerFn() factories.
 * The createServerFn() boundary for these must be defined in each app's own
 * source (its own team.functions.ts / account.functions.ts), not inside
 * this package's pre-compiled dist — see each file's own doc comment for
 * why. Usage:
 *
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { listTeamMembersServer, type ListTeamMembersInput } from "@joasuite/shared-ui/server";
 *   import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
 *
 *   export const listTeamMembers = createServerFn({ method: "POST" })
 *     .middleware([requireSupabaseAuth])
 *     .inputValidator((i) => z.object({...}).parse(i) satisfies ListTeamMembersInput)
 *     .handler(({ data, context }) => listTeamMembersServer(data, context as never));
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

export { assertSafeExternalUrl } from "./content-core-utils";

export {
  createListNotifications,
  createMarkNotificationRead,
  createMarkAllNotificationsRead,
} from "./notifications.functions";

export {
  listManageableTenantsServer,
  listManageableUsersServer,
  inviteUserToWorkspacesServer,
  setUserAppRolesServer,
  accountResendInvitationServer,
  accountSendPasswordResetServer,
  accountUpdateUserProfileServer,
  getMyProfileServer,
  updateMyTimezoneServer,
  updateMyDefaultTenantServer,
  ACCOUNT_APP_ROLES,
  type AccountContext,
  type AccountDeps,
  type SendEmailFn,
  type AccountAppRole,
  type AccountPortal,
  type AppAssignmentInput,
  type InviteUserToWorkspacesInput,
  type SetUserAppRolesInput,
  type AccountUserIdInput,
  type AccountUpdateUserProfileInput,
  type UpdateMyTimezoneInput,
  type UpdateMyDefaultTenantInput,
} from "./account.server";

export {
  listTeamMembersServer,
  getTeamMemberServer,
  upsertTeamMemberServer,
  listDepartmentsAndPositionsServer,
  createDepartmentServer,
  updateDepartmentServer,
  deleteDepartmentServer,
  createPositionServer,
  updatePositionServer,
  deletePositionServer,
  getOrgChartTreeServer,
  MAX_DEPARTMENT_DEPTH,
  type TeamContext,
  type TeamDeps,
  type OrgStructureDeps,
  type ListTeamMembersInput,
  type TeamMemberInput,
  type UpsertTeamMemberInput,
  type TenantInput,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
  type DeleteDepartmentInput,
  type CreatePositionInput,
  type UpdatePositionInput,
  type DeletePositionInput,
  type OrgChartDepartment,
  type OrgChartPosition,
  type OrgChartPerson,
} from "./team.server";

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
  canManageBillingFnServer,
  getBillingOverviewServer,
  updateBillingCustomerServer,
  listBillingPlansServer,
  changeSubscriptionPlanServer,
  cancelSubscriptionServer,
  listBillingInvoicesServer,
  getBillingInvoiceServer,
  retryInvoicePaymentServer,
  seedSampleBillingInvoicesServer,
  listBillingPaymentMethodsServer,
  addMockPaymentMethodServer,
  setDefaultPaymentMethodServer,
  removePaymentMethodServer,
  startTrialServer,
  reactivateSubscriptionServer,
  addAppSubscriptionServer,
  removeAppSubscriptionServer,
  listAvailablePromotionsServer,
  listTenantDiscountsServer,
  redeemPromoCodeServer,
  removeTenantDiscountServer,
  getReferralProgramServer,
  addMockReferralServer,
  updateReferralStatusServer,
  getTenantUsageServer,
  listActiveBundleRulesServer,
  APP_CODES as BILLING_APP_CODES,
  PLAN_CODES as BILLING_PLAN_CODES,
  INTERVALS as BILLING_INTERVALS,
  type BillingContext,
  type BillingDeps,
  type AppCode as BillingAppCode,
  type PlanCode as BillingPlanCode,
  type BillingInterval,
  type TenantInput as BillingTenantInput,
  type UpdateBillingCustomerInput,
  type ListBillingPlansInput,
  type ChangeSubscriptionPlanInput,
  type CancelSubscriptionInput,
  type ListBillingInvoicesInput,
  type GetBillingInvoiceInput,
  type AddMockPaymentMethodInput,
  type PaymentMethodIdInput,
  type StartTrialInput,
  type AppSubscriptionInput,
  type AddAppSubscriptionInput,
  type RedeemPromoCodeInput,
  type RemoveTenantDiscountInput,
  type AddMockReferralInput,
  type UpdateReferralStatusInput,
  type GetTenantUsageInput,
} from "./billing.server";
