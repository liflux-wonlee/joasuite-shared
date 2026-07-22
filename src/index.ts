// Public surface of @joasuite/shared-ui.

// Constants & types
export * from "./constants";
export * from "./types";

// Provider / context
export {
  JoaSuiteProvider,
  useJoaSuite,
  type JoaSuiteContextValue,
  type AuthState,
  type UiAdapter,
  type RouterAdapter,
  type BoundServerFns,
} from "./context";

// i18n
export { mergeSharedResources, SUPPORTED_LANGUAGES } from "./i18n-helper";

// Components (see src/components/*.tsx). Each is refactored to use
// useJoaSuite() for app-specific dependencies.
export { ThemeToggle } from "./components/ThemeToggle";
export { LanguageSwitcher } from "./components/LanguageSwitcher";
export { UserBadge } from "./components/UserBadge";
export { NotificationsBell } from "./components/NotificationsBell";
export { SuiteSwitcher } from "./components/SuiteSwitcher";
export { SuiteHomePage } from "./components/SuiteHomePage";
export { SuiteSettingsHub } from "./components/SuiteSettingsHub";
export { PostLoginGate } from "./components/PostLoginGate";
export { SignUpForm } from "./components/SignUpForm";
export { SetPasswordForm } from "./components/SetPasswordForm";
export { OrgScopeToggle } from "./components/OrgScopeToggle";
export { AppOverviewSection } from "./components/AppOverviewSection";
export { UserListPage } from "./components/users/UserListPage";
export { UserInvitePage } from "./components/users/UserInvitePage";
export { UserDetailPage } from "./components/users/UserDetailPage";
export { TeamListPage } from "./components/team/TeamListPage";
export { TeamMemberForm } from "./components/team/TeamMemberForm";
export { TeamMemberView } from "./components/team/TeamMemberView";
export { InviteAsUserBanner } from "./components/team/InviteAsUserBanner";
export { FieldGroup, FieldRow } from "./components/FieldGroup";
export { OrgStructureSettingsPage } from "./components/org-structure/OrgStructureSettingsPage";
export { OrgChartView } from "./components/org-structure/OrgChartView";
export type {
  OrgChartViewProps,
  OrgChartDepartmentT,
  OrgChartPositionT,
  OrgChartPersonT,
} from "./components/org-structure/OrgChartView";

// Billing (organization-scoped; identical across every JoaSuite app)
export { BillingLayout } from "./components/billing/BillingLayout";
export { BillingOverviewPage } from "./components/billing/BillingOverviewPage";
export { PlansSection } from "./components/billing/PlansSection";
export { BillingPaymentMethodsPage } from "./components/billing/BillingPaymentMethodsPage";
export { BillingInvoicesPage } from "./components/billing/BillingInvoicesPage";
export { BillingDiscountsPage } from "./components/billing/BillingDiscountsPage";
export { BillingReferralsPage } from "./components/billing/BillingReferralsPage";
export { BillingUsagePage } from "./components/billing/BillingUsagePage";
export { BillingDetailsPage } from "./components/billing/BillingDetailsPage";
export { BillingComparePage } from "./components/billing/BillingComparePage";

// Hooks
export { useOrgScope } from "./hooks/useOrgScope";
