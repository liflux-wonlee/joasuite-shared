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
export {
  AttachmentPreviewDialog,
  guessAttachmentKind,
  type AttachmentPreviewKind,
  type AttachmentPreviewDialogProps,
} from "./components/AttachmentPreviewDialog";
export {
  DocumentLibraryTable,
  type DocumentLibraryRow,
  type DocumentLibraryTableProps,
} from "./components/DocumentLibraryTable";
export {
  type ContentRelationProvider,
  type ContentRelationRow,
  type RelationEntityTypeOption,
  type RelationSearchResult,
} from "./lib/content-relations";
export {
  type ContentType,
  type ContentItem,
  type ContentVersion,
  type ContentOrigin,
  type ContentItemDetail,
  type ContentSearchFilters,
} from "./lib/content-core-types";
export {
  type ContentProvider,
  type ContentAuthorizationProvider,
} from "./lib/content-core-provider";
export { LinkToRecordDialog, type LinkToRecordDialogProps } from "./components/LinkToRecordDialog";
export { RelatedRecordsPanel, type RelatedRecordsPanelProps } from "./components/RelatedRecordsPanel";
export { ArchiveContentAction, type ArchiveContentActionProps } from "./components/ArchiveContentAction";
export { DeletePermanentlyAction, type DeletePermanentlyActionProps } from "./components/DeletePermanentlyAction";
export { AddExternalLinkDialog, type AddExternalLinkDialogProps } from "./components/AddExternalLinkDialog";
export { ContentVersionsPanel, type ContentVersionsPanelProps } from "./components/ContentVersionsPanel";
export { ContentUploader, type ContentUploaderProps } from "./components/ContentUploader";
export { ContentDetail, type ContentDetailProps } from "./components/ContentDetail";
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
