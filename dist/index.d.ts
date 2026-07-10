import { A as AppCode } from './constants-CjPROrfF.js';
export { a as APP_CODES, b as APP_DISPLAY, D as DEFAULT_APP_URLS, R as ROLES_BY_APP, S as SETTINGS_KV_APP_URL_KEYS } from './constants-CjPROrfF.js';
import * as react from 'react';
import { ComponentType, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

type Membership = {
    tenant_id: string;
    tenant_name: string | null;
    roles: string[];
    portal?: "internal" | "vendor" | "approver" | "customer";
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
    DialogFooter: ComponentType<any>;
    DialogHeader: ComponentType<any>;
    DialogTitle: ComponentType<any>;
    DialogTrigger: ComponentType<any>;
    Tabs: ComponentType<any>;
    TabsList: ComponentType<any>;
    TabsTrigger: ComponentType<any>;
    TabsContent: ComponentType<any>;
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
    accountResendInvitation: (input: {
        user_id: string;
    }) => Promise<any>;
    accountSendPasswordReset: (input: {
        user_id: string;
    }) => Promise<any>;
    accountUpdateUserProfile: (input: any) => Promise<any>;
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

declare function AppSubscriptionsSummary(): react.JSX.Element | null;

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

declare function PeopleListPage(): react.JSX.Element;

declare function PeopleInvitePage(): react.JSX.Element;

declare function PeopleDetailPage({ userId }: {
    userId: string;
}): react.JSX.Element;

/**
 * Local "which organizations am I looking at" state for a screen that wants
 * an org-scope selector (Dashboard, JoaSuite Home). Defaults to the user's
 * current active organization and follows it when they switch via the
 * workspace switcher — as long as they haven't deliberately widened the
 * selection to more than one org.
 */
declare function useOrgScope(): [string[], (tenantIds: string[]) => void];

export { type AppCatalogEntry, AppCode, AppOverviewSection, AppSubscriptionsSummary, type AppSummaryTile, type ApprovalSummary, type AuthState, type BoundServerFns, type JoaSuiteContextValue, JoaSuiteProvider, LanguageSwitcher, type Membership, type NotificationRow, NotificationsBell, OrgScopeToggle, PeopleDetailPage, PeopleInvitePage, PeopleListPage, type RouterAdapter, SUPPORTED_LANGUAGES, type SuiteHomeData, SuiteHomePage, SuiteSettingsHub, SuiteSwitcher, type TenantAppRow, ThemeToggle, type UiAdapter, UserBadge, mergeSharedResources, useJoaSuite, useOrgScope };
