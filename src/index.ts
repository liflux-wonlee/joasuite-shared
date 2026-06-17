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
export { PeopleListPage } from "./components/people/PeopleListPage";
export { PeopleInvitePage } from "./components/people/PeopleInvitePage";
export { PeopleDetailPage } from "./components/people/PeopleDetailPage";
