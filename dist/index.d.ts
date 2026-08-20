import { A as AppCode } from './constants-ME_hdmjZ.js';
export { a as APP_CODES, b as APP_DISPLAY, D as DEFAULT_APP_URLS, R as ROLES_BY_APP, S as SETTINGS_KV_APP_URL_KEYS, r as roleLabel } from './constants-ME_hdmjZ.js';
import * as react from 'react';
import { ComponentType, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

type Membership = {
    tenant_id: string;
    tenant_name: string | null;
    roles: string[];
    portal?: "internal" | "vendor" | "approver" | "customer";
    /** Active `tenant_apps.app_code` values for this tenant. Drives PostLoginGate's app-subscription check. */
    apps: string[];
};
/**
 * "Users" (suite login/tenant-membership management) types. Deliberately
 * named distinctly from the Team (Employee/Contractor) types below —
 * a Suite "user" is a login identity with per-app roles; an "employee" is a
 * `parties`/`employee_profiles` business record that may or may not have a
 * login at all. Do not conflate the two.
 */
type UserAppAssignment = {
    tenant_id: string;
    portal: string;
    status: string;
    joined_at: string | null;
    position: string | null;
    apps: Record<string, {
        roles: string[];
    }>;
};
type ManageableUserRow = {
    user_id: string;
    email: string | null;
    display_name: string | null;
    position: string | null;
    joined_at: string | null;
    last_sign_in_at: string | null;
    assignments: Record<string, UserAppAssignment>;
};
type ManageableTenant = {
    id: string;
    name: string;
    slug: string;
    app_codes: string[];
    app_plans?: Record<string, string | null>;
};
type InvitePresetKey = "owner_admin" | "manager" | "finance_staff" | "field_tech" | "approver" | "custom";
/**
 * Team (Employee/Contractor) types (shared across every JoaSuite app
 * except the future JoaHR app, which owns the full HR surface). These map
 * to the shared core tables `departments`/`positions`/`parties`/
 * `employee_profiles` — never to HR-confidential extension tables, which
 * remain app-owned (e.g. JoaOffice's `office.employee_hr_records`).
 */
type Department = {
    id: string;
    name: string;
    code: string | null;
};
type Position = {
    id: string;
    name: string;
    department_id: string;
};
type TeamMemberRow = {
    party_id: string;
    linked_user_id: string | null;
    name_en: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    department_id: string | null;
    department: string | null;
    position_id: string | null;
    position: string | null;
    manager_id: string | null;
    employment_status: string | null;
    hire_date: string | null;
    termination_date: string | null;
    worker_type: "employee" | "contractor" | null;
};
type TeamMemberInput = {
    tenant_id: string;
    party_id?: string;
    linked_user_id?: string;
    name_en?: string;
    contact_email?: string;
    contact_phone?: string;
    department_id?: string | null;
    position_id?: string | null;
    manager_id?: string | null;
    employment_status?: "active" | "on_leave" | "terminated";
    hire_date?: string | null;
    termination_date?: string | null;
    worker_type: "employee" | "contractor";
};
type AppCatalogEntry = {
    code: AppCode | string;
    name: string;
    description: string | null;
    plans: Array<{
        code: string;
        name: string;
    }>;
    sort_order: number;
};
type TenantAppRow = {
    app_code: AppCode | string;
    plan: string;
    status: "active" | "canceled" | string;
    activated_at: string;
    canceled_at: string | null;
    deletion_scheduled_at: string | null;
};
type ApprovalSummary = {
    id: string;
    doc_kind: string;
    doc_id: string;
    sequence_no: number | null;
    created_at: string;
    title: string | null;
    amount_usd: number | null;
    due_date: string | null;
    source_app: string;
};
type NotificationRow = {
    id: string;
    kind: string;
    title: string;
    body: string | null;
    link_path: string | null;
    read_at: string | null;
    created_at: string;
    app_code: string | null;
};
type SuiteHomeData = {
    appUrls: Record<string, string>;
    myApprovals: ApprovalSummary[];
    notifications: NotificationRow[];
    recentActivity: Array<{
        id: string;
        action: string;
        record_type: string;
        record_id: string;
        user_name: string | null;
        created_at: string;
        app_code: string | null;
    }>;
};
/**
 * Standard shape each app implements to summarize its own state for the
 * JoaSuite Home "App Overview" section. The core only defines the shape —
 * every metric behind it is computed and owned by the app itself.
 */
type AppSummaryTile = {
    app_code: AppCode;
    headline_label: string;
    headline_value: string;
    trend?: "up" | "down" | "flat";
    secondary: Array<{
        label: string;
        value: string;
    }>;
    alert_count?: number;
    link_path: string;
};

type AuthState = {
    user: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown>;
    } | null;
    currentTenantId: string | null;
    currentMembership: Membership | null;
    memberships: Membership[];
    setCurrentTenantId: (id: string) => void;
    refresh: () => Promise<void>;
    signOut: () => Promise<void> | void;
};
/**
 * Minimal shadcn UI surface used by shared components. Pass the host
 * app's existing shadcn re-exports here so styling stays consistent.
 *
 * Why not bundle shadcn in the package? Because each app's
 * `src/styles.css` defines its own theme tokens and shadcn variants —
 * we want shared components to inherit the host theme, not fight it.
 */
type UiAdapter = {
    Button: ComponentType<any>;
    Input: ComponentType<any>;
    Label: ComponentType<any>;
    Badge: ComponentType<any>;
    Card: ComponentType<any>;
    Checkbox: ComponentType<any>;
    DropdownMenu: ComponentType<any>;
    DropdownMenuContent: ComponentType<any>;
    DropdownMenuItem: ComponentType<any>;
    DropdownMenuLabel: ComponentType<any>;
    DropdownMenuSeparator: ComponentType<any>;
    DropdownMenuTrigger: ComponentType<any>;
    Popover: ComponentType<any>;
    PopoverContent: ComponentType<any>;
    PopoverTrigger: ComponentType<any>;
    Select: ComponentType<any>;
    SelectContent: ComponentType<any>;
    SelectItem: ComponentType<any>;
    SelectTrigger: ComponentType<any>;
    SelectValue: ComponentType<any>;
    Dialog: ComponentType<any>;
    DialogContent: ComponentType<any>;
    DialogDescription: ComponentType<any>;
    DialogFooter: ComponentType<any>;
    DialogHeader: ComponentType<any>;
    DialogTitle: ComponentType<any>;
    DialogTrigger: ComponentType<any>;
    Tabs: ComponentType<any>;
    TabsList: ComponentType<any>;
    TabsTrigger: ComponentType<any>;
    TabsContent: ComponentType<any>;
    Textarea: ComponentType<any>;
    EmailInput: ComponentType<any>;
};
/**
 * Router adapter — TanStack Router's `<Link>` is type-aware of the host
 * app's routes, so the host must supply it (and useNavigate) rather than
 * letting the package import @tanstack/react-router types directly.
 */
type RouterAdapter = {
    Link: ComponentType<any>;
    useNavigate: () => (opts: {
        to: string;
        params?: Record<string, string>;
    }) => void;
    /** Current location pathname, for active-tab/nav highlighting in layout-style components. */
    usePathname: () => string;
};
/**
 * Bound server function. The host app exports a `useServerFn`-wrapped
 * version of each shared server function (see ./server) and passes them
 * in. The shared components just call them like ordinary async fns.
 */
type BoundServerFns = {
    listSuiteApps: (input: {
        tenantId: string;
    }) => Promise<{
        catalog: any[];
        subscriptions: any[];
        myAppCodes: string[];
    }>;
    subscribeApp: (input: {
        tenantId: string;
        appCode: string;
        plan: string;
    }) => Promise<{
        ok: true;
    }>;
    cancelApp: (input: {
        tenantId: string;
        appCode: string;
    }) => Promise<{
        ok: true;
    }>;
    createTenant: (input: {
        name: string;
        display_name?: string;
    }) => Promise<{
        tenant: {
            id: string;
            [k: string]: any;
        };
    }>;
    getSuiteHome: (input: {
        tenantId: string;
    }) => Promise<any>;
    setAppUrl: (input: {
        tenantId: string;
        appCode: AppCode;
        url: string;
    }) => Promise<{
        ok: true;
    }>;
    getAppSummaries: (input: {
        tenantIds: string[];
    }) => Promise<AppSummaryTile[]>;
    listNotifications: (input: {
        tenant_id: string;
        limit?: number;
    }) => Promise<{
        unread_count: number;
        rows: any[];
    }>;
    markNotificationRead: (input: {
        id: string;
    }) => Promise<{
        ok: true;
    }>;
    markAllNotificationsRead: (input: {
        tenant_id: string;
    }) => Promise<{
        ok: true;
    }>;
    listManageableUsers: () => Promise<{
        tenants: any[];
        users: any[];
        caller_owner_tenant_ids: string[];
    }>;
    inviteUserToWorkspaces: (input: any) => Promise<any>;
    setUserAppRoles: (input: any) => Promise<any>;
    removeTenantUser: (input: any) => Promise<any>;
    inviteTenantUser: (input: {
        tenant_id: string;
        email: string;
        display_name: string;
        position?: string;
        portal?: "internal" | "vendor" | "approver" | "customer";
        roles?: string[];
        party_id?: string;
    }) => Promise<{
        user_id: string;
        created: boolean;
        added_existing: boolean;
        already_member: boolean;
    }>;
    /** Has this signed-in user ever held ANY tenant_users row (any tenant, any status)? Used by PostLoginGate to tell a brand-new signup apart from someone whose access was removed. */
    hasEverHadMembership: () => Promise<{
        ever: boolean;
    }>;
    accountResendInvitation: (input: {
        user_id: string;
    }) => Promise<any>;
    accountSendPasswordReset: (input: {
        user_id: string;
    }) => Promise<any>;
    accountUpdateUserProfile: (input: any) => Promise<any>;
    listTeamMembers: (input: {
        tenant_id: string;
        search?: string;
        worker_type?: "employee" | "contractor";
    }) => Promise<{
        rows: any[];
    }>;
    getTeamMember: (input: {
        tenant_id: string;
        party_id: string;
    }) => Promise<any>;
    upsertTeamMember: (input: any) => Promise<{
        party_id: string;
        created: boolean;
    }>;
    listDepartmentsAndPositions: (input: {
        tenant_id: string;
    }) => Promise<{
        departments: any[];
        positions: any[];
    }>;
    createDepartment: (input: {
        tenant_id: string;
        name: string;
        code?: string | null;
        parent_department_id?: string | null;
    }) => Promise<any>;
    updateDepartment: (input: {
        tenant_id: string;
        id: string;
        name: string;
        code?: string | null;
        parent_department_id?: string | null;
    }) => Promise<any>;
    deleteDepartment: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    createPosition: (input: {
        tenant_id: string;
        department_id: string;
        name: string;
    }) => Promise<any>;
    updatePosition: (input: {
        tenant_id: string;
        id: string;
        name: string;
    }) => Promise<any>;
    deletePosition: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    getOrgChartTree: (input: {
        tenant_id: string;
    }) => Promise<{
        roots: any[];
    }>;
    canManageBillingFn: (input: {
        tenant_id: string;
    }) => Promise<{
        can_manage: boolean;
        can_view: boolean;
        roles: string[];
    }>;
    getBillingOverview: (input: {
        tenant_id: string;
    }) => Promise<any>;
    updateBillingCustomer: (input: any) => Promise<any>;
    listBillingPlans: (input?: {
        app_code?: string;
        interval?: "month" | "year";
    }) => Promise<any[]>;
    changeSubscriptionPlan: (input: {
        tenant_id: string;
        app_code: string;
        plan_code: string;
        interval?: "month" | "year";
        seats?: number;
    }) => Promise<any>;
    cancelSubscription: (input: {
        tenant_id: string;
        app_code: string;
        at_period_end?: boolean;
    }) => Promise<any>;
    listBillingInvoices: (input: {
        tenant_id: string;
        limit?: number;
    }) => Promise<any[]>;
    getBillingInvoice: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    retryInvoicePayment: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    seedSampleBillingInvoices: (input: {
        tenant_id: string;
    }) => Promise<any>;
    listBillingPaymentMethods: (input: {
        tenant_id: string;
    }) => Promise<any[]>;
    addMockPaymentMethod: (input: {
        tenant_id: string;
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
        make_default?: boolean;
    }) => Promise<any>;
    setDefaultPaymentMethod: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    removePaymentMethod: (input: {
        tenant_id: string;
        id: string;
    }) => Promise<any>;
    startTrial: (input: {
        tenant_id: string;
        app_code: string;
        plan_code?: string;
        interval?: "month" | "year";
        trial_days?: number;
    }) => Promise<any>;
    reactivateSubscription: (input: {
        tenant_id: string;
        app_code: string;
    }) => Promise<any>;
    addAppSubscription: (input: {
        tenant_id: string;
        app_code: string;
        plan_code?: string;
        interval?: "month" | "year";
    }) => Promise<any>;
    removeAppSubscription: (input: {
        tenant_id: string;
        app_code: string;
    }) => Promise<any>;
    listAvailablePromotions: (input: {
        tenant_id: string;
    }) => Promise<any[]>;
    listTenantDiscounts: (input: {
        tenant_id: string;
    }) => Promise<any[]>;
    redeemPromoCode: (input: {
        tenant_id: string;
        code: string;
    }) => Promise<any>;
    removeTenantDiscount: (input: {
        tenant_id: string;
        discount_id: string;
    }) => Promise<any>;
    getReferralProgram: (input: {
        tenant_id: string;
    }) => Promise<any>;
    addMockReferral: (input: {
        tenant_id: string;
        referee_email: string;
        referee_org_name?: string;
        status?: "pending" | "signed_up" | "subscribed";
    }) => Promise<any>;
    updateReferralStatus: (input: {
        tenant_id: string;
        referral_id: string;
        status: "pending" | "signed_up" | "subscribed" | "canceled";
    }) => Promise<any>;
    getTenantUsage: (input: {
        tenant_id: string;
        app_code?: string;
    }) => Promise<any>;
    listActiveBundleRules: () => Promise<any[]>;
};
type JoaSuiteContextValue = {
    /** The current host app's canonical code. */
    currentApp: AppCode;
    supabase: SupabaseClient;
    useAuth: () => AuthState;
    ui: UiAdapter;
    router: RouterAdapter;
    fns: BoundServerFns;
    /** localStorage key used by ThemeToggle. Defaults to `joasuite-theme`. */
    themeStorageKey?: string;
};
declare function JoaSuiteProvider({ value, children, }: {
    value: JoaSuiteContextValue;
    children: ReactNode;
}): react.JSX.Element;
declare function useJoaSuite(): JoaSuiteContextValue;

/**
 * Deep-merge shared namespaces (`suite.*`, `people.*`, `account.*`,
 * `bell.*`, `common.*`, `set.*`) into the host app's per-language
 * resources. App-specific keys override shared keys.
 */
declare function mergeSharedResources(appResources: Record<string, Record<string, unknown>>): Record<string, {
    translation: Record<string, unknown>;
}>;
declare const SUPPORTED_LANGUAGES: readonly [{
    readonly code: "en";
    readonly label: "English";
}, {
    readonly code: "ko";
    readonly label: "한국어";
}, {
    readonly code: "zh";
    readonly label: "中文";
}, {
    readonly code: "es";
    readonly label: "Español";
}, {
    readonly code: "vi";
    readonly label: "Tiếng Việt";
}];

declare function ThemeToggle(): react.JSX.Element;

interface Props {
    className?: string;
    variant?: "sidebar" | "default";
}
declare function LanguageSwitcher({ className, variant }: Props): react.JSX.Element;

declare function UserBadge(): react.JSX.Element;

declare function NotificationsBell(): react.JSX.Element;

declare function SuiteSwitcher(): react.JSX.Element;

declare function SuiteHomePage(): react.JSX.Element | null;

declare function SuiteSettingsHub(): react.JSX.Element;

/**
 * Renders `children` once the signed-in user has an active membership in a
 * tenant that's subscribed to the current app. Otherwise renders the branch
 * that applies:
 *   - no membership anywhere -> create an organization
 *   - owner/super_admin of a tenant that hasn't enabled this app -> one-click subscribe
 *   - member (non-owner) of a tenant that hasn't enabled this app -> ask the owner
 * All three reuse existing primitives (createTenant / subscribeApp) - no new
 * server functions. Membership existence itself is never revealed pre-auth;
 * this component only runs post-authentication.
 */
declare function PostLoginGate({ children }: {
    children: ReactNode;
}): react.JSX.Element;

/**
 * Passwordless, email-first signup. Calls signInWithOtp with
 * shouldCreateUser:true, which is safe to use identically for both a
 * brand-new email and an email that already has a JoaSuite account
 * (Supabase never reveals which case it is, never touches an existing
 * password, and never creates a duplicate account) - the two cases are
 * disambiguated later, safely, by SetPasswordForm after the link is
 * clicked, not here. No password field on this screen at all, so there's
 * nothing for an existing user to "silently lose" by re-submitting this
 * form with a new value.
 */
declare function SignUpForm(): react.JSX.Element;

/**
 * Landing page for SignUpForm's magic-link email. Supabase's client
 * auto-detects the session from the callback URL, so this just waits for
 * that, then decides what to show:
 *   - Account created within the last few minutes (this signup flow just
 *     created it) -> genuinely new user, offer to set a password.
 *   - Otherwise -> an existing user who already has a password just
 *     re-verified their email via magic link; nothing new to set up,
 *     send them straight into the app.
 * This is what safely resolves the new-vs-existing ambiguity that
 * SignUpForm deliberately can't: it happens post-auth, after Supabase has
 * already proven which case it is via account age, not by asking a
 * pre-auth endpoint to reveal it.
 */
declare function SetPasswordForm(): react.JSX.Element;

/**
 * Lets the user widen a screen (Dashboard, JoaSuite Home) from "this
 * organization" to any combination of the organizations they belong to.
 * Hidden entirely for users with only one eligible membership — there's
 * nothing to scope. No elevated role is required: a user may always
 * aggregate across organizations they're already an active member of.
 *
 * Only `internal` memberships are eligible — `vendor`/`approver`/
 * `customer` portal grants are narrow, single-purpose access to someone
 * else's tenant, not "one of my organizations," and must never be folded
 * into a cross-org aggregate. This is a UI hint only; the server
 * independently re-verifies portal type for every requested tenant id
 * (see `resolveScopedTenantIds` in `./server`).
 */
declare function OrgScopeToggle({ value, onChange, }: {
    value: string[];
    onChange: (tenantIds: string[]) => void;
}): react.JSX.Element | null;

/**
 * "App Overview" section for JoaSuite Home — one tile per app that has
 * implemented the `AppSummaryTile` contract (see types.ts). Apps that
 * haven't implemented it yet simply don't produce a tile; there is no
 * placeholder per-app row here, since the core has no way to know an app
 * exists until it starts returning a tile.
 */
declare function AppOverviewSection({ tenantIds }: {
    tenantIds: string[];
}): react.JSX.Element;

declare function UserListPage(): react.JSX.Element;

declare function UserInvitePage(): react.JSX.Element;

declare function UserDetailPage({ userId }: {
    userId: string;
}): react.JSX.Element;

type TeamListPageProps = {
    tenantId: string;
    /** Restrict this view to one worker type. Omit to show the combined directory. */
    workerType?: "employee" | "contractor";
    /** Called after a create-new save, in addition to closing the dialog — e.g. so a host app can trigger its own app-specific follow-up (JoaSOP re-runs Requirements Matrix auto-assignment when the saved entry is linked to a tenant login). */
    onEntrySaved?: (result: {
        party_id: string;
        created: boolean;
    }) => void;
    /**
     * Route prefix a row navigates to on click, e.g. "/app/team/members" ->
     * "/app/team/members/$partyId" (the read-only detail page; see
     * TeamMemberView). Defaults to "/app/team/members", which every current
     * consuming app mounts this at — override only if a host app uses a
     * different path.
     */
    basePath?: string;
};
declare function TeamListPage({ tenantId, workerType: fixedWorkerType, onEntrySaved, basePath, }: TeamListPageProps): react.JSX.Element;

type TeamMemberFormProps = {
    tenantId: string;
    /** Edit an existing team member by party id (no login required). */
    partyId?: string;
    /** Edit (or create) the team member tied to an existing tenant login. */
    linkedUserId?: string;
    /** Disable all fields; used for self-view / read-only embeds. */
    readOnly?: boolean;
    /** Preselect worker type for a brand-new entry (e.g. opened from a Contractor-only view). Still editable. */
    defaultWorkerType?: "employee" | "contractor";
    onSaved?: (result: {
        party_id: string;
        created: boolean;
    }) => void;
};
/**
 * Shared basic Employee/Contractor info form — name/contact, department,
 * position, manager, employment status/dates, worker type. Reused
 * identically (same code, no per-app fork) across every JoaSuite app except
 * the future JoaHR app. Never touches HR-confidential fields (compensation,
 * contracts, leave) — those stay in each app's own HR-owned tables.
 *
 * Editing only — the invite-as-user action lives on TeamMemberView (the
 * read-only detail page callers show first) rather than here, since it's a
 * standalone action, not a field being edited.
 *
 * No Dialog/Card chrome of its own — callers embed it inline (e.g. a
 * read-only Profile tab) or wrap it in their own Dialog (e.g. an "Add team
 * member" flow) as fits the surrounding page.
 */
declare function TeamMemberForm({ tenantId, partyId, linkedUserId, readOnly, defaultWorkerType, onSaved, }: TeamMemberFormProps): react.JSX.Element;

type TeamMemberViewProps = {
    tenantId: string;
    partyId: string;
    /** Called when the top-right Edit button is clicked — the host app owns navigation to its own edit route. */
    onEdit?: () => void;
};
/**
 * Read-only Team Member detail — the default landing page when opening a
 * team member (see TeamListPage). Editing happens on a separate page,
 * reached via the Edit button here, not inline.
 */
declare function TeamMemberView({ tenantId, partyId, onEdit }: TeamMemberViewProps): react.JSX.Element;

type InviteAsUserBannerProps = {
    tenantId: string;
    partyId: string;
    name: string | null | undefined;
    email: string | null | undefined;
    linkedUserId: string | null | undefined;
};
/**
 * Team Members are HR/directory records first — creating one never
 * auto-invites a login (some workers never need one). Inviting is a
 * separate, explicit admin action: it invites-or-links this person's
 * account and grants them the "employee" role for THIS app only, then
 * links parties.linked_user_id so future self-scoped views resolve them.
 *
 * Lives on TeamMemberView (the read-only detail page) rather than
 * TeamMemberForm — it's a standalone action, not a field being edited.
 */
declare function InviteAsUserBanner({ tenantId, partyId, name, email, linkedUserId }: InviteAsUserBannerProps): react.JSX.Element;

/**
 * Groups related fields under a subtitle with a light gray background —
 * shared visual convention for detail/edit pages across every JoaSuite app
 * (Team Member view/edit, JoaHR's Workforce overview, etc.). Purely
 * presentational, no data-fetching or app-specific logic.
 */
declare function FieldGroup({ title, children, className }: {
    title: string;
    children: ReactNode;
    className?: string;
}): react.JSX.Element;
/** A single label/value row for read-only display inside a FieldGroup. */
declare function FieldRow({ label, value }: {
    label: string;
    value: ReactNode;
}): react.JSX.Element;

type AttachmentPreviewKind = "image" | "pdf" | "other";
/**
 * Best-effort file-kind guess from filename/mime, shared so every app's
 * attachment UI treats "what can we preview inline" the same way.
 */
declare function guessAttachmentKind(filename: string, mime?: string | null): AttachmentPreviewKind;
type AttachmentPreviewDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filename?: string;
    kind: AttachmentPreviewKind;
    /** Inline-viewable URL (signed URL or blob: URL) for image/pdf kinds. */
    previewUrl?: string;
    /** Download URL/href offered next to the filename. */
    downloadUrl?: string;
    downloadLabel?: string;
    /**
     * Render a PDF viewer for `previewUrl`. Falls back to a plain <iframe>
     * when omitted -- pass your app's own richer viewer (e.g. a react-pdf
     * component) to upgrade it without forking this dialog.
     */
    renderPdf?: (url: string) => ReactNode;
};
/**
 * Presentational image/PDF preview modal, factored out of JoaBooks'
 * AttachmentsPanel so JoaBooks' new Document Library page (and any future
 * per-app attachment UI) can reuse the same "click a file, see it inline"
 * behavior instead of re-implementing it. Uses only the ui.Dialog/Button
 * primitives every app already supplies via JoaSuiteProvider -- no new
 * UiAdapter fields, no server-function DI, so adopting this doesn't
 * require any change to an app's provider wiring.
 */
declare function AttachmentPreviewDialog({ open, onOpenChange, filename, kind, previewUrl, downloadUrl, downloadLabel, renderPdf, }: AttachmentPreviewDialogProps): react.JSX.Element;

type DocumentLibraryRow = {
    id: string;
    filename: string;
    /** Attachment kind (receipt/contract/w9/...), shown as a secondary tag. */
    kind?: string | null;
    /** Human label for the doc_kind this attachment belongs to, e.g. "Bill", "Invoice". Pass pre-translated. */
    docKindLabel: string;
    /** Display label for the record this file is attached to, e.g. a Bill number or vendor name. */
    linkedLabel?: string | null;
    /** Where clicking the linked-record cell should navigate, if anywhere. */
    linkedHref?: string | null;
    size?: number | null;
    createdAt?: string | null;
    uploadedByLabel?: string | null;
};
type DocumentLibraryTableProps = {
    rows: DocumentLibraryRow[];
    loading?: boolean;
    formatSize?: (n: number | null | undefined) => string;
    formatDate?: (s: string | null | undefined) => string;
    /** Open the file for preview/download. */
    onOpen?: (row: DocumentLibraryRow) => void;
    /** Navigate to the row's linked record (linkedHref). */
    onNavigate?: (row: DocumentLibraryRow) => void;
    onDelete?: (row: DocumentLibraryRow) => void;
    /** Open the Related Records / Link-to-record flow for this row. */
    onLink?: (row: DocumentLibraryRow) => void;
};
/**
 * Presentational cross-record file table -- the browse/search surface for
 * an app's "Document Library"-style page (as opposed to AttachmentsPanel,
 * which is scoped to one record). Every row's data and every action is
 * supplied by the host app (server-function calls, routing, deletion
 * confirmation) rather than this component reaching into app-specific
 * state, matching the plain presentational pattern already used by
 * FieldGroup/FieldRow rather than the fns-DI pattern used by pages like
 * TeamListPage -- this keeps adoption a zero-wiring drop-in for any app
 * that already calls JoaSuiteProvider, since it only touches the
 * ui.Button primitive every app already supplies.
 */
declare function DocumentLibraryTable({ rows, loading, formatSize, formatDate, onOpen, onNavigate, onDelete, onLink, }: DocumentLibraryTableProps): react.JSX.Element;

/**
 * Shared Content Core — relation-provider contract.
 *
 * A relation provider tells the generic Link-to-record UI what entity types
 * an app supports and how to search/resolve them, WITHOUT the shared
 * package ever knowing about Bills, Vendors, or any app-specific table.
 * Each app supplies its own provider; JoaOffice can supply none at all
 * (no financial linking controls exist there even if the tenant also has
 * JoaBooks -- see the "current-app capability" rule).
 *
 * entityType values are deliberately the same strings as this suite's
 * existing public.doc_kind enum (e.g. "party", "payment_request",
 * "joahr.worker_document") -- see the content_relations migration's own
 * comment for why: it lets content_relations rows be authorized by calling
 * the already-unified public.user_can_view_doc() directly.
 */
type RelationEntityTypeOption = {
    /** Same value space as public.doc_kind, e.g. "party", "payment_request". */
    entityType: string;
    /** Display label, e.g. "Vendor", "Bill". Pass pre-translated. */
    label: string;
};
type RelationSearchResult = {
    entityId: string;
    /** Primary line, e.g. "BILL-2026-0182". */
    label: string;
    /** Secondary line with useful context, e.g. "Comcast · $328.42 · Aug 2026". */
    sublabel?: string;
};
type ContentRelationProvider = {
    getEntityTypes(): RelationEntityTypeOption[];
    searchEntities(entityType: string, query: string): Promise<RelationSearchResult[]>;
    /**
     * Batch-resolve display info for already-linked entities (e.g. to render
     * "Related Records"), keyed by `${entityType}:${entityId}`. Only entries
     * the caller can actually see need to be present in the result.
     */
    resolveEntities(refs: Array<{
        entityType: string;
        entityId: string;
    }>): Promise<Record<string, RelationSearchResult>>;
    /** Where clicking a search result / an existing relation should navigate. Return null if there's no detail page. */
    getEntityHref(entityType: string, entityId: string): string | null;
};
type ContentRelationRow = {
    id: string;
    contentItemId: string;
    appCode: string;
    entityType: string;
    entityId: string;
    relationType: string;
    createdAt: string;
};

type LinkToRecordDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    provider: ContentRelationProvider;
    /** Called when the user picks a search result. Resolve to close the dialog on success. */
    onLink: (entityType: string, result: RelationSearchResult) => Promise<void>;
};
/**
 * "Link to record" — deliberately not "Assign" (per the JoaBooks UX rule:
 * a content item may relate to many records, many-to-many). Presentational
 * + a search callback; the host app owns what entity types exist and how
 * to search them via `provider`.
 */
declare function LinkToRecordDialog({ open, onOpenChange, provider, onLink }: LinkToRecordDialogProps): react.JSX.Element;

type RelatedRecordsPanelProps = {
    relations: ContentRelationRow[];
    provider: ContentRelationProvider;
    onLink: (entityType: string, result: RelationSearchResult) => Promise<void>;
    onUnlink?: (relation: ContentRelationRow) => Promise<void>;
    onNavigate?: (href: string) => void;
    loading?: boolean;
};
/**
 * "Related Records" -- the many-to-many relationship section (per the
 * JoaBooks UX rule: never "Assigned to"). Shows every current relation for
 * one content item and a button to add another. Bidirectional visibility
 * (a Bill showing which content items relate to IT) is the host app's own
 * page composing this same data from the other direction -- this component
 * only renders the content-item side.
 */
declare function RelatedRecordsPanel({ relations, provider, onLink, onUnlink, onNavigate, loading }: RelatedRecordsPanelProps): react.JSX.Element;

declare function OrgStructureSettingsPage({ tenantId }: {
    tenantId: string;
}): react.JSX.Element;

type OrgChartPersonT = {
    party_id: string;
    name: string;
    worker_type?: string | null;
    avatar_url?: string | null;
};
type OrgChartPositionT = {
    id: string;
    name: string;
    people: OrgChartPersonT[];
};
type OrgChartDepartmentT = {
    id: string;
    name: string;
    depth: number;
    positions: OrgChartPositionT[];
    children: OrgChartDepartmentT[];
};
type OrgChartViewProps = {
    /** Fetch the tree via the shared `getOrgChartTree` server fn. Omit if passing `tree` directly. */
    tenantId?: string;
    /** Pre-fetched tree — use this to feed the chart from an app-local data layer (e.g. JoaHR's own Workforce module) instead of the shared server fn. */
    tree?: OrgChartDepartmentT[];
    isLoading?: boolean;
};
/**
 * Visual org chart: department tree with nested positions, each position
 * fanning out to the people currently holding it (photo/initials, name,
 * position). Pure CSS connector lines — no graph library dependency, so
 * this stays cheap to embed anywhere, including an app that feeds it a
 * locally-shaped tree instead of the shared `getOrgChartTree` fn.
 */
declare function OrgChartView({ tenantId, tree, isLoading }: OrgChartViewProps): react.JSX.Element;

declare function BillingLayout({ children }: {
    children: React.ReactNode;
}): react.JSX.Element;

declare function BillingOverviewPage(): react.JSX.Element | null;

declare function PlansSection(): react.JSX.Element;

declare function BillingPaymentMethodsPage(): react.JSX.Element;

declare function BillingInvoicesPage(): react.JSX.Element;

declare function BillingDiscountsPage(): react.JSX.Element;

declare function BillingReferralsPage(): react.JSX.Element;

declare function BillingUsagePage(): react.JSX.Element;

declare function BillingDetailsPage(): react.JSX.Element;

/**
 * Plan comparison for a single app. `appCode` is supplied by the host route
 * file's own `validateSearch` (each app's `/app/account/billing/compare`
 * route reads its own typed `app` search param and passes it down) —
 * this component can't call `useSearch()` itself since that hook is typed
 * to the host's own route tree.
 */
declare function BillingComparePage({ appCode }: {
    appCode: string;
}): react.JSX.Element;

/**
 * Local "which organizations am I looking at" state for a screen that wants
 * an org-scope selector (Dashboard, JoaSuite Home). Defaults to the user's
 * current active organization and follows it when they switch via the
 * workspace switcher — as long as they haven't deliberately widened the
 * selection to more than one org.
 */
declare function useOrgScope(): [string[], (tenantIds: string[]) => void];

export { type AppCatalogEntry, AppCode, AppOverviewSection, type AppSummaryTile, type ApprovalSummary, AttachmentPreviewDialog, type AttachmentPreviewDialogProps, type AttachmentPreviewKind, type AuthState, BillingComparePage, BillingDetailsPage, BillingDiscountsPage, BillingInvoicesPage, BillingLayout, BillingOverviewPage, BillingPaymentMethodsPage, BillingReferralsPage, BillingUsagePage, type BoundServerFns, type ContentRelationProvider, type ContentRelationRow, type Department, type DocumentLibraryRow, DocumentLibraryTable, type DocumentLibraryTableProps, FieldGroup, FieldRow, InviteAsUserBanner, type InvitePresetKey, type JoaSuiteContextValue, JoaSuiteProvider, LanguageSwitcher, LinkToRecordDialog, type LinkToRecordDialogProps, type ManageableTenant, type ManageableUserRow, type Membership, type NotificationRow, NotificationsBell, type OrgChartDepartmentT, type OrgChartPersonT, type OrgChartPositionT, OrgChartView, type OrgChartViewProps, OrgScopeToggle, OrgStructureSettingsPage, PlansSection, type Position, PostLoginGate, RelatedRecordsPanel, type RelatedRecordsPanelProps, type RelationEntityTypeOption, type RelationSearchResult, type RouterAdapter, SUPPORTED_LANGUAGES, SetPasswordForm, SignUpForm, type SuiteHomeData, SuiteHomePage, SuiteSettingsHub, SuiteSwitcher, TeamListPage, TeamMemberForm, type TeamMemberInput, type TeamMemberRow, TeamMemberView, type TenantAppRow, ThemeToggle, type UiAdapter, type UserAppAssignment, UserBadge, UserDetailPage, UserInvitePage, UserListPage, guessAttachmentKind, mergeSharedResources, useJoaSuite, useOrgScope };
