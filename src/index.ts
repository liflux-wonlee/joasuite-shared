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
export { AppSubscriptionsSummary } from "./components/AppSubscriptionsSummary";
export { OrgScopeToggle } from "./components/OrgScopeToggle";
export { AppOverviewSection } from "./components/AppOverviewSection";
export { UserListPage } from "./components/users/UserListPage";
export { UserInvitePage } from "./components/users/UserInvitePage";
export { UserDetailPage } from "./components/users/UserDetailPage";
export { TeamListPage } from "./components/team/TeamListPage";
export { TeamMemberForm } from "./components/team/TeamMemberForm";
export { OrgStructureSettingsPage } from "./components/org-structure/OrgStructureSettingsPage";

// Hooks
export { useOrgScope } from "./hooks/useOrgScope";
