import { A as AppCode } from '../constants-ME_hdmjZ.js';
export { a as BILLING_APP_CODES } from '../constants-ME_hdmjZ.js';
import * as _tanstack_start_client_core from '@tanstack/start-client-core';
import { SupabaseClient } from '@supabase/supabase-js';

type AppCatalogEntry = {
    code: string;
    name: string;
    description: string | null;
    plans: Array<{
        code: string;
        name: string;
    }>;
    sort_order: number;
};
type TenantAppRow = {
    app_code: string;
    plan: string;
    status: string;
    activated_at: string;
    canceled_at: string | null;
    deletion_scheduled_at: string | null;
};
type Deps$2 = {
    requireSupabaseAuth: any;
    appCode: string;
};
declare function createListSuiteApps(deps: Deps$2): _tanstack_start_client_core.OptionalFetcher<readonly [any], (d: unknown) => {
    tenantId: string;
}, Promise<{
    catalog: AppCatalogEntry[];
    subscriptions: TenantAppRow[];
    myAppCodes: string[];
}>>;
declare function createSubscribeApp(deps: Deps$2): _tanstack_start_client_core.OptionalFetcher<readonly [any], (d: unknown) => {
    tenantId: string;
    appCode: string;
    plan: string;
}, Promise<{
    ok: true;
}>>;
declare function createCancelApp(deps: Deps$2): _tanstack_start_client_core.OptionalFetcher<readonly [any], (d: unknown) => {
    tenantId: string;
    appCode: string;
}, Promise<{
    ok: true;
}>>;

type SuiteHomeData = {
    appUrls: Record<string, string>;
    myApprovals: Array<{
        id: string;
        doc_kind: string;
        doc_id: string;
        sequence_no: number | null;
        created_at: string;
        title: string | null;
        amount_usd: number | null;
        due_date: string | null;
        source_app: string;
        link_path: string | null;
    }>;
    requestedByMe: Array<{
        id: string;
        kind: "payment_request";
        no: string | null;
        status: string;
        amount_usd: number | null;
        created_at: string;
    }>;
    notifications: Array<{
        id: string;
        kind: string;
        title: string;
        body: string | null;
        link_path: string | null;
        read_at: string | null;
        created_at: string;
        app_code: string | null;
    }>;
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
type Deps$1 = {
    requireSupabaseAuth: any;
    appCode: string;
};
declare function createGetSuiteHome(deps: Deps$1): _tanstack_start_client_core.OptionalFetcher<readonly [any], (d: unknown) => {
    tenantId: string;
}, Promise<SuiteHomeData>>;
declare function createSetAppUrl(deps: Deps$1): _tanstack_start_client_core.OptionalFetcher<readonly [any], (d: unknown) => {
    tenantId: string;
    appCode: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop";
    url: string;
}, Promise<{
    ok: true;
}>>;

/**
 * Verifies every requested tenant_id is an active membership of `userId`
 * before a cross-organization query is allowed to run. No elevated role is
 * required — a user may always aggregate across organizations they already
 * belong to (unlike, say, an internal audit-log view of other users'
 * activity).
 *
 * The one restriction: combining more than one organization is only
 * available to `internal` memberships. `vendor`/`approver`/`customer`
 * portal grants are narrow, single-purpose access to someone else's
 * tenant, not a real membership in "one of my organizations" — they must
 * never be folded into a cross-org aggregate. A single-organization
 * request (tenantIds length 1) isn't restricted by portal type; it just
 * needs to be an active membership, matching the pre-existing
 * single-tenant behavior.
 *
 * A plain helper rather than a `createServerFn` factory: it has nothing
 * app-specific to inject (no email sender, no app code) and is meant to be
 * called from inside another handler that already has an authenticated
 * `supabase` client and `userId` from its own middleware.
 */
declare function resolveScopedTenantIds(supabase: SupabaseClient, userId: string, tenantIds: string[]): Promise<string[]>;

type Deps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
    appCode: string;
    /**
     * When true, the bell shows notifications from EVERY app the user has
     * (a single unified cross-app bell), tagging each row with its source
     * app_code so the UI can badge/deep-link non-current-app notifications.
     * When false/omitted, only this app's own rows (+ app_code IS NULL
     * suite-wide rows) are returned - the original, narrower behavior.
     */
    crossApp?: boolean;
};
declare function createListNotifications(deps: Deps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    unread_only: boolean;
    limit: number;
}, Promise<{
    rows: any;
    unread_count: any;
}>>;
declare function createMarkNotificationRead(deps: Deps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    id: string;
}, Promise<{
    ok: true;
}>>;
declare function createMarkAllNotificationsRead(deps: Deps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    ok: true;
}>>;

/**
 * Shared Account module (Users-page tenant/user management + self-profile)
 * — plain business-logic functions, deliberately NOT wrapped in
 * `createServerFn()` here.
 *
 * Same root cause and fix as team.server.ts (see that file's doc comment
 * for the full history): a `createServerFn()` call living inside this
 * package's pre-compiled dist can lose `context.userId` at the handler,
 * because it's this package's own build step processing the call rather
 * than each consuming app's TanStack Start/router-plugin Vite build.
 * Confirmed broken here too via a real report on joaoffice/joasop's Users
 * page ("You don't own or super-admin any organizations yet." even for
 * actual owners) and independently re-fixed by Lovable in joasop
 * (`src/lib/account.server.ts` + local createServerFn wrappers in
 * `src/lib/account.functions.ts`, mirroring the team fix).
 *
 * So the split is the same as team.server.ts: this file owns the actual
 * Supabase queries and authorization logic (the part that's genuinely
 * identical across apps and worth sharing); each consuming app's own
 * `account.functions.ts` supplies a thin
 * `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 * .inputValidator(...).handler(({data, context}) => xServer(data, context
 * as never, deps))` wrapper living in its own source, so the
 * createServerFn() boundary is always app-local.
 *
 * Unlike team.server.ts's read/write gates, `AccountDeps` here stays
 * dependency-injected (supabaseAdmin/sendEmail/appBaseUrl/appName/appCode)
 * because those genuinely vary per app — same shape as the old
 * createServerFn-factory version's `AccountDeps`, minus
 * `requireSupabaseAuth` (which now lives only in each app's local
 * wrapper's `.middleware([...])` call, not in deps).
 */
type AccountContext = {
    userId: string;
};
type SendEmailFn = (input: {
    to: string;
    subject: string;
    html: string;
}) => Promise<any>;
type AccountDeps = {
    supabaseAdmin: any;
    sendEmail: SendEmailFn;
    /** Fallback base URL used to build invite/reset links when APP_BASE_URL is unset, e.g. "https://books.joasuite.com". */
    appBaseUrl: string;
    /** Display name used in transactional emails, e.g. "JoaBooks". */
    appName: string;
    /** Canonical app_code, used as the fallback when a user_roles/app_code row predates multi-app support, e.g. "joabooks". */
    appCode: string;
};
declare const ACCOUNT_APP_ROLES: readonly ["owner", "super_admin", "admin", "billing_admin", "finance_ap", "finance_ar", "finance_manager", "accountant", "approver", "vendor", "customer", "hr_manager", "manager", "employee", "sop_admin", "sop_author", "sop_reviewer", "sop_operator"];
type AccountAppRole = (typeof ACCOUNT_APP_ROLES)[number];
type AccountPortal = "internal" | "vendor" | "approver" | "customer";
type AppAssignmentInput = {
    app_code: string;
    roles: AccountAppRole[];
};
type InviteUserToWorkspacesInput = {
    email: string;
    display_name: string;
    position?: string;
    primary_tenant_id?: string;
    assignments: Array<{
        tenant_id: string;
        portal: AccountPortal;
        apps: AppAssignmentInput[];
    }>;
};
type SetUserAppRolesInput = {
    tenant_id: string;
    user_id: string;
    app_code: string;
    roles: AccountAppRole[];
};
type AccountUserIdInput = {
    user_id: string;
};
type AccountUpdateUserProfileInput = {
    user_id: string;
    display_name: string;
    email?: string;
    position?: string | null;
};
type UpdateMyTimezoneInput = {
    timezone: string | null;
};
type UpdateMyDefaultTenantInput = {
    tenant_id: string | null;
};
declare function listManageableTenantsServer(context: AccountContext, deps: AccountDeps): Promise<any>;
declare function listManageableUsersServer(context: AccountContext, deps: AccountDeps): Promise<{
    tenants: any;
    users: {
        user_id: string;
        email: string | null;
        display_name: string | null;
        position: string | null;
        joined_at: string | null;
        last_sign_in_at: string | null;
        assignments: Record<string, {
            tenant_id: string;
            portal: string;
            status: string;
            joined_at: string | null;
            position: string | null;
            apps: Record<string, {
                roles: string[];
            }>;
        }>;
    }[];
    caller_owner_tenant_ids: string[];
}>;
declare function inviteUserToWorkspacesServer(input: InviteUserToWorkspacesInput, context: AccountContext, deps: AccountDeps): Promise<{
    user_id: any;
    created: boolean;
    tenants_added: number;
    primary_tenant_id: string;
    email: any;
}>;
declare function setUserAppRolesServer(input: SetUserAppRolesInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
}>;
declare function accountResendInvitationServer(input: AccountUserIdInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
    email: any;
}>;
declare function accountSendPasswordResetServer(input: AccountUserIdInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
    email: any;
}>;
declare function accountUpdateUserProfileServer(input: AccountUpdateUserProfileInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
}>;
declare function getMyProfileServer(context: AccountContext, deps: AccountDeps): Promise<{
    default_tenant_id: string | null;
    timezone: string | null;
}>;
declare function updateMyTimezoneServer(input: UpdateMyTimezoneInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
}>;
declare function updateMyDefaultTenantServer(input: UpdateMyDefaultTenantInput, context: AccountContext, deps: AccountDeps): Promise<{
    ok: boolean;
}>;

/**
 * Shared Team (Employee/Contractor) + org-structure (Departments/Positions/
 * OrgChart) module — plain business-logic functions, deliberately NOT
 * wrapped in `createServerFn()` here.
 *
 * History: this used to export `createServerFn().middleware([...])`-wrapped
 * factories directly (`createListTeamMembers(deps)` etc., taking
 * `deps.requireSupabaseAuth`). In production, `context.supabase`/
 * `context.userId` injected by that per-function `.middleware()` composition
 * would sometimes arrive at the handler as an empty object -- confirmed via
 * a temporary diagnostic guard that fired with genuinely empty context,
 * despite the middleware wiring and gate functions all checking out correct
 * in source across multiple rounds of review. The one thing that reliably
 * fixed it (confirmed independently in joasop, then replicated in joaoffice
 * and joahr) was moving the `createServerFn()` call itself into each app's
 * own source tree, where that app's own TanStack Start/router-plugin build
 * step processes it directly, instead of inside this package's pre-compiled
 * npm dist output.
 *
 * So the split now is: this file owns the actual Supabase queries and
 * authorization logic (the part that's genuinely identical across apps and
 * worth sharing); each consuming app's own `team.functions.ts` supplies a
 * thin `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 * .inputValidator(...).handler(({data, context}) => xServer(data, context
 * as never, deps))` wrapper living in its own source, so the createServerFn
 * boundary is always app-local.
 *
 * Team member read/write gates used to be hardcoded here (unscoped
 * `is_internal_staff`/a raw unscoped `user_roles` query), with a doc
 * comment claiming this "must NOT diverge per app" was intentional. That
 * claim didn't survive scrutiny: `admin`/`hr_manager` (the roles checked)
 * are app-scoped by this package's own conventions (see `ROLES_BY_APP` in
 * `src/constants.ts` and the `app_code`-stamping grant paths in
 * `admin.functions.ts`/`account.server.ts`), so an unscoped check let a
 * user with a matching role in ANY one app read/write EVERY app's Team
 * directory once any consuming app called these functions. JoaBooks had
 * already independently forked this exact logic to a scoped
 * `is_joabooks_staff` check rather than use these shared functions -- now
 * that gates are injected (like `OrgStructureDeps` below), every consumer
 * can supply its own scoped check and there is no shared/local fork to
 * keep in sync.
 */
type TeamContext = {
    supabase: any;
    userId: string;
};
type TeamDeps = {
    /** Read-gate: who may see the Team directory (names, contact info, employment status, etc). */
    assertCanReadTeam: (supabase: any, tenantId: string, userId: string) => Promise<void>;
    /** Write-gate: who may create/edit Team member records. */
    assertCanWriteTeam: (supabase: any, tenantId: string, userId: string) => Promise<void>;
};
type OrgStructureDeps = {
    /** Read-gate: any tenant member who may see the org structure. */
    assertCanReadOrgStructure: (supabase: any, tenantId: string, userId: string) => Promise<void>;
    /** Write-gate: who may create/edit/delete departments and positions. */
    assertCanManageOrgStructure: (supabase: any, tenantId: string, userId: string) => Promise<void>;
};
declare const MAX_DEPARTMENT_DEPTH = 4;
type ListTeamMembersInput = {
    tenant_id: string;
    search?: string;
    worker_type?: "employee" | "contractor";
};
type TeamMemberInput = {
    tenant_id: string;
    party_id: string;
};
type UpsertTeamMemberInput = {
    tenant_id: string;
    party_id?: string;
    linked_user_id?: string;
    name_en?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    department_id?: string | null;
    position_id?: string | null;
    manager_id?: string | null;
    employment_status?: "active" | "on_leave" | "terminated";
    hire_date?: string | null;
    termination_date?: string | null;
    worker_type: "employee" | "contractor";
};
type TenantInput$1 = {
    tenant_id: string;
};
type CreateDepartmentInput = {
    tenant_id: string;
    name: string;
    code?: string | null;
    parent_department_id?: string | null;
};
type UpdateDepartmentInput = CreateDepartmentInput & {
    id: string;
};
type DeleteDepartmentInput = {
    tenant_id: string;
    id: string;
};
type CreatePositionInput = {
    tenant_id: string;
    department_id: string;
    name: string;
};
type UpdatePositionInput = {
    tenant_id: string;
    id: string;
    name: string;
};
type DeletePositionInput = {
    tenant_id: string;
    id: string;
};
declare function listTeamMembersServer(input: ListTeamMembersInput, context: TeamContext, deps: TeamDeps): Promise<{
    rows: any;
}>;
declare function getTeamMemberServer(input: TeamMemberInput, context: TeamContext, deps: TeamDeps): Promise<{
    party_id: any;
    linked_user_id: any;
    name_en: any;
    contact_email: any;
    contact_phone: any;
    active: any;
    department_id: any;
    department: string | null;
    position_id: any;
    position: string | null;
    manager_id: any;
    employment_status: any;
    hire_date: any;
    termination_date: any;
    worker_type: any;
}>;
/**
 * `appCode`, if given, is stamped onto `parties.source_app`/
 * `employee_profiles.source_app` (both nullable) so multi-app records can be
 * traced back to whichever app created/last wrote them. Purely informational
 * — omit it and the columns are simply left null.
 */
declare function upsertTeamMemberServer(input: UpsertTeamMemberInput, context: TeamContext, deps: TeamDeps, appCode?: string): Promise<{
    party_id: string;
    created: boolean;
}>;
declare function listDepartmentsAndPositionsServer(input: TenantInput$1, context: TeamContext, deps: OrgStructureDeps): Promise<{
    departments: any;
    positions: any;
}>;
declare function createDepartmentServer(input: CreateDepartmentInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    id: any;
}>;
declare function updateDepartmentServer(input: UpdateDepartmentInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    ok: boolean;
}>;
declare function deleteDepartmentServer(input: DeleteDepartmentInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    ok: boolean;
}>;
declare function createPositionServer(input: CreatePositionInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    id: any;
}>;
declare function updatePositionServer(input: UpdatePositionInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    ok: boolean;
}>;
declare function deletePositionServer(input: DeletePositionInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
    ok: boolean;
}>;
type OrgChartPerson = {
    party_id: string;
    name: string;
    worker_type: string | null;
};
type OrgChartPosition = {
    id: string;
    name: string;
    people: OrgChartPerson[];
};
type OrgChartDepartment = {
    id: string;
    name: string;
    depth: number;
    positions: OrgChartPosition[];
    children: OrgChartDepartment[];
};
declare function getOrgChartTreeServer(input: TenantInput$1, context: TeamContext, deps: OrgStructureDeps): Promise<{
    roots: OrgChartDepartment[];
}>;

type SendEmail = (input: {
    to: string;
    subject: string;
    html: string;
}) => Promise<any>;
/** A doc/child table that references a `parties` row, for mergeParties reassignment. */
type PartyRefTable = {
    table: string;
    column: string;
    label?: string;
};
type AdminDeps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
    sendEmail: SendEmail;
    /** Fallback base URL used to build invite/reset links when APP_BASE_URL is unset. */
    appBaseUrl: string;
    /** Display name used in transactional emails, e.g. "JoaBooks". */
    appName: string;
    /**
     * This app's canonical app_code (e.g. "joabooks", "joaoffice"). Used both
     * as a fallback for legacy rows predating multi-app support, and to scope
     * app-specific role checks (assertOwnerOrAdmin / assertCanEditVendor) so a
     * role granted in a different suite app never satisfies this app's checks.
     */
    appCode: string;
};
type MergePartiesDeps = AdminDeps & {
    /** Tables that BLOCK a party delete and get REASSIGNED on merge. See each app's party-references.ts. */
    partyDocRefTables: PartyRefTable[];
    /** Owned sub-record tables that get REASSIGNED on merge and cascade (don't block) on delete. */
    partyChildTables: PartyRefTable[];
};
declare function createGetTenantSettings(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createUpdateTenantSettings(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    name?: string | undefined;
    settings?: Record<string, any> | undefined;
}, Promise<any>>;
declare function createListTenantUsers(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createGetTenantUser(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
}, Promise<any>>;
declare function createUpdateTenantUserProfile(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
    display_name: string;
    position?: string | null | undefined;
}, Promise<{
    ok: true;
}>>;
/**
 * Has this signed-in user ever held ANY tenant_users row, in any tenant,
 * regardless of status? Used by PostLoginGate to tell a brand-new signup
 * (never had one) apart from someone whose only membership was removed or
 * deactivated (had one, doesn't anymore) — those two cases need different
 * copy, since "create an organization" is misleading for the latter.
 */
declare function createHasEverHadMembership(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<{
    ever: boolean;
}>>;
declare function createInviteTenantUser(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    email: string;
    display_name: string;
    portal: "approver" | "internal" | "vendor" | "customer";
    roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "hr_manager" | "manager" | "employee" | "billing_admin" | "vendor" | "customer")[];
    position?: string | undefined;
    party_id?: string | undefined;
}, Promise<{
    user_id: any;
    created: boolean;
    added_existing: boolean;
    already_member: boolean;
    email: any;
}>>;
declare function createResendInvitation(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
}, Promise<{
    ok: true;
    email: any;
}>>;
declare function createSendPasswordResetLink(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
}, Promise<{
    ok: true;
    email: any;
}>>;
declare function createUpdateTenantUserRoles(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
    roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "hr_manager" | "manager" | "employee" | "billing_admin" | "vendor" | "customer")[];
    app_code?: string | undefined;
}, Promise<{
    ok: true;
}>>;
declare function createSetTenantUserStatus(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
    status: "active" | "invited" | "suspended";
}, Promise<{
    ok: true;
}>>;
declare function createRemoveTenantUser(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
}, Promise<{
    ok: true;
}>>;
declare function createListParties(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    kind: "vendor" | "customer" | "all";
}, Promise<any>>;
declare function createUpsertParty(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    name_en: string;
    payee_type: "business" | "individual";
    is_vendor: boolean;
    is_customer: boolean;
    is_payee: boolean;
    is_payer: boolean;
    active: boolean;
    id?: string | undefined;
    nick_name?: string | null | undefined;
    legal_address?: string | null | undefined;
    address_line1?: string | null | undefined;
    address_line2?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    postal_code?: string | null | undefined;
    country?: string | null | undefined;
    contact_name?: string | null | undefined;
    contact_email?: string | null | undefined;
    contact_phone?: string | null | undefined;
    tag?: string | null | undefined;
    tax_id?: string | null | undefined;
    tax_form_type?: string | null | undefined;
    is_1099_vendor?: boolean | undefined;
    w9_attachment_id?: string | null | undefined;
    default_category_id?: string | null | undefined;
    default_payment_method?: string | null | undefined;
    default_currency?: string | null | undefined;
    website?: string | null | undefined;
    internal_notes?: string | null | undefined;
}, Promise<{
    id: any;
}>>;
declare function createDeleteParty(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<{
    ok: true;
}>>;
declare function createGetParty(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<{
    party: any;
    bank_accounts: any[];
    bank_accounts_history: any[];
    contacts: any;
}>>;
declare function createListPartyContacts(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<any>>;
declare function createUpsertPartyContact(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
    name: string;
    id?: string | undefined;
    email?: string | null | undefined;
    phone?: string | null | undefined;
    role_note?: string | null | undefined;
    is_primary?: boolean | undefined;
    active?: boolean | undefined;
}, Promise<{
    id: any;
}>>;
declare function createDeletePartyContact(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    contact_id: string;
}, Promise<{
    ok: true;
}>>;
declare function createInvitePartyContact(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    contact_id: string;
}, Promise<{
    ok: true;
    user_id: any;
    email: any;
}>>;
declare function createRevokePartyContact(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    contact_id: string;
}, Promise<{
    ok: true;
}>>;
/**
 * List parties (of any category — vendors, customers, and per the JoaSuite
 * employee/party design, eventually employees too) the current user has
 * portal access to in the given tenant — either as the main linked user on
 * parties.linked_user_id, OR as an active linked contact in party_contacts.
 * Named for its original vendor-portal use case; the underlying query is
 * generic to any party category.
 */
declare function createListMyAccessibleVendors(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createListMyVendorTenants(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<string[]>>;
declare function createUpsertPartyBankAccount(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
    bank: {
        id?: string | null | undefined;
        bank_name?: string | null | undefined;
        account_number?: string | null | undefined;
        routing_number?: string | null | undefined;
        swift?: string | null | undefined;
        bank_address?: string | null | undefined;
        bank_phone?: string | null | undefined;
        bank_addr_line1?: string | null | undefined;
        bank_addr_line2?: string | null | undefined;
        bank_addr_city?: string | null | undefined;
        bank_addr_state?: string | null | undefined;
        bank_addr_zip?: string | null | undefined;
    };
}, Promise<{
    id: string;
    archived_previous: true;
} | {
    id: any;
    archived_previous: false;
}>>;
declare function createDeletePartyBankAccount(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    bank_id: string;
}, Promise<{
    ok: true;
    archived: true;
} | {
    ok: true;
    archived: false;
}>>;
declare function createArchiveParty(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
    reason?: string | undefined;
}, Promise<{
    ok: true;
}>>;
declare function createUnarchiveParty(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<{
    ok: true;
}>>;
declare function createCleanupPartyContacts(deps: AdminDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<{
    ok: true;
    removed: number;
}>>;
/**
 * Merge source party into target party. Reassigns every table registered in
 * deps.partyDocRefTables / deps.partyChildTables (see each app's
 * party-references.ts), then deletes the source row. Generic across apps —
 * a new module only needs to add its table to that app's registry, not edit
 * this function.
 */
declare function createMergeParties(deps: MergePartiesDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    source_party_id: string;
    target_party_id: string;
}, Promise<{
    ok: true;
    target_party_id: any;
    reassigned: Record<string, number>;
}>>;

/**
 * Shared Billing module — plain business-logic functions, deliberately NOT
 * wrapped in `createServerFn()` here.
 *
 * Same root cause and fix as team.server.ts/account.server.ts (see those
 * files' doc comments for the full history): a `createServerFn()` call
 * living inside this package's pre-compiled dist can lose
 * context.supabase/context.userId at the handler, because it's this
 * package's own build step processing the call rather than each consuming
 * app's TanStack Start/router-plugin Vite build. Confirmed broken here too
 * via a real report on JoaHR's Billing & Plan page ("Cannot read
 * properties of undefined (reading 'from')" — context.supabase arriving
 * empty at the handler despite `.middleware([deps.requireSupabaseAuth])`
 * being correctly wired in source).
 *
 * So the split is the same as team.server.ts/account.server.ts: this file
 * owns the actual Supabase queries and authorization logic (the part
 * that's genuinely identical across apps and worth sharing); each
 * consuming app's own `billing.functions.ts` supplies a thin
 * `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 * .inputValidator(...).handler(({data, context}) => xServer(data, context
 * as never, deps))` wrapper living in its own source, so the
 * createServerFn() boundary is always app-local.
 *
 * `BillingDeps` only carries `supabaseAdmin` now (used for the public plan
 * catalog read, which has no auth context, and for best-effort audit-log
 * writes) — `requireSupabaseAuth` moved out since it now lives only in
 * each app's local wrapper's `.middleware([...])` call.
 */

declare const PLAN_CODES: readonly ["free", "basic", "pro", "business"];
declare const INTERVALS: readonly ["month", "year"];
type PlanCode = (typeof PLAN_CODES)[number];
type BillingInterval = (typeof INTERVALS)[number];
type BillingContext = {
    supabase: any;
    userId: string;
};
type BillingDeps = {
    supabaseAdmin: any;
    appCode: string;
};
type TenantInput = {
    tenant_id: string;
};
declare function canManageBillingFnServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<{
    can_manage: boolean;
    can_view: boolean;
    roles: string[];
}>;
declare function getBillingOverviewServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<{
    tenant: any;
    customer: any;
    subscriptions: any;
    default_payment_method: any;
    next_invoice_estimate_cents: number;
    roles: string[];
    can_manage: boolean;
    can_view: boolean;
}>;
type UpdateBillingCustomerInput = {
    tenant_id: string;
    billing_email?: string | null;
    company_legal_name?: string | null;
    tax_id?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    default_currency?: string;
    billing_phone?: string | null;
    billing_contact_name?: string | null;
    billing_contact_email?: string | null;
    invoice_memo?: string | null;
};
declare function updateBillingCustomerServer(input: UpdateBillingCustomerInput, context: BillingContext, deps: BillingDeps): Promise<any>;
type ListBillingPlansInput = {
    app_code?: AppCode;
    interval?: BillingInterval;
};
declare function listBillingPlansServer(input: ListBillingPlansInput, deps: BillingDeps): Promise<any>;
type ChangeSubscriptionPlanInput = {
    tenant_id: string;
    app_code: AppCode;
    plan_code: PlanCode;
    interval: BillingInterval;
    seats: number;
};
declare function changeSubscriptionPlanServer(input: ChangeSubscriptionPlanInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    subscription: any;
}>;
type CancelSubscriptionInput = {
    tenant_id: string;
    app_code: AppCode;
    at_period_end: boolean;
};
declare function cancelSubscriptionServer(input: CancelSubscriptionInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    subscription: any;
}>;
type ListBillingInvoicesInput = {
    tenant_id: string;
    limit: number;
};
declare function listBillingInvoicesServer(input: ListBillingInvoicesInput, context: BillingContext, deps: BillingDeps): Promise<any>;
type GetBillingInvoiceInput = {
    tenant_id: string;
    id: string;
};
declare function getBillingInvoiceServer(input: GetBillingInvoiceInput, context: BillingContext, deps: BillingDeps): Promise<any>;
declare function retryInvoicePaymentServer(input: GetBillingInvoiceInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    message: string;
}>;
declare function seedSampleBillingInvoicesServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    inserted: number;
    skipped: boolean;
} | {
    ok: boolean;
    inserted: number;
    skipped?: undefined;
}>;
declare function listBillingPaymentMethodsServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<any>;
type AddMockPaymentMethodInput = {
    tenant_id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    make_default: boolean;
};
declare function addMockPaymentMethodServer(input: AddMockPaymentMethodInput, context: BillingContext, deps: BillingDeps): Promise<any>;
type PaymentMethodIdInput = {
    tenant_id: string;
    id: string;
};
declare function setDefaultPaymentMethodServer(input: PaymentMethodIdInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
}>;
declare function removePaymentMethodServer(input: PaymentMethodIdInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
}>;
type StartTrialInput = {
    tenant_id: string;
    app_code: AppCode;
    plan_code: PlanCode;
    interval: BillingInterval;
    trial_days: number;
};
declare function startTrialServer(input: StartTrialInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    subscription: any;
}>;
type AppSubscriptionInput = {
    tenant_id: string;
    app_code: AppCode;
};
declare function reactivateSubscriptionServer(input: AppSubscriptionInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    subscription: any;
}>;
type AddAppSubscriptionInput = {
    tenant_id: string;
    app_code: AppCode;
    plan_code: PlanCode;
    interval: BillingInterval;
};
declare function addAppSubscriptionServer(input: AddAppSubscriptionInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
    subscription: any;
}>;
declare function removeAppSubscriptionServer(input: AppSubscriptionInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    mock: boolean;
}>;
declare function listAvailablePromotionsServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<any>;
declare function listTenantDiscountsServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<any>;
type RedeemPromoCodeInput = {
    tenant_id: string;
    code: string;
};
declare function redeemPromoCodeServer(input: RedeemPromoCodeInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: false;
    reason: "not_found";
    discount?: undefined;
} | {
    ok: false;
    reason: "upcoming" | "expired";
    discount?: undefined;
} | {
    ok: false;
    reason: "exhausted";
    discount?: undefined;
} | {
    ok: false;
    reason: "already_applied";
    discount?: undefined;
} | {
    ok: true;
    discount: any;
    reason?: undefined;
}>;
type RemoveTenantDiscountInput = {
    tenant_id: string;
    discount_id: string;
};
declare function removeTenantDiscountServer(input: RemoveTenantDiscountInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
}>;
declare function getReferralProgramServer(input: TenantInput, context: BillingContext, deps: BillingDeps): Promise<{
    program: any;
    referrals: any;
}>;
type AddMockReferralInput = {
    tenant_id: string;
    referee_email: string;
    referee_org_name?: string;
    status: "pending" | "signed_up" | "subscribed";
};
declare function addMockReferralServer(input: AddMockReferralInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
    referral: any;
}>;
type UpdateReferralStatusInput = {
    tenant_id: string;
    referral_id: string;
    status: "pending" | "signed_up" | "subscribed" | "canceled";
};
declare function updateReferralStatusServer(input: UpdateReferralStatusInput, context: BillingContext, deps: BillingDeps): Promise<{
    ok: boolean;
}>;
type PlanLimits = {
    users: number | null;
    customers: number | null;
    invoices_per_month: number | null;
    storage_gb: number | null;
    projects: number | null;
    attachments: number | null;
};
type GetTenantUsageInput = {
    tenant_id: string;
    app_code?: string;
};
declare function getTenantUsageServer(input: GetTenantUsageInput, context: BillingContext, deps: BillingDeps): Promise<{
    app_code: string;
    plan_code: any;
    plan_status: any;
    limits: PlanLimits;
    usage: {
        users: any;
        customers: any;
        invoices_this_month: any;
        attachments: any;
        storage_gb: number;
        active_apps: any;
        projects: number;
    };
}>;
declare function listActiveBundleRulesServer(context: BillingContext): Promise<any>;

export { ACCOUNT_APP_ROLES, type AccountAppRole, type AccountContext, type AccountDeps, type AccountPortal, type AccountUpdateUserProfileInput, type AccountUserIdInput, type AddAppSubscriptionInput, type AddMockPaymentMethodInput, type AddMockReferralInput, type AdminDeps, type AppAssignmentInput, type AppCatalogEntry, AppCode, type AppSubscriptionInput, INTERVALS as BILLING_INTERVALS, PLAN_CODES as BILLING_PLAN_CODES, AppCode as BillingAppCode, type BillingContext, type BillingDeps, type BillingInterval, type PlanCode as BillingPlanCode, type TenantInput as BillingTenantInput, type CancelSubscriptionInput, type ChangeSubscriptionPlanInput, type CreateDepartmentInput, type CreatePositionInput, type DeleteDepartmentInput, type DeletePositionInput, type GetBillingInvoiceInput, type GetTenantUsageInput, type InviteUserToWorkspacesInput, type ListBillingInvoicesInput, type ListBillingPlansInput, type ListTeamMembersInput, MAX_DEPARTMENT_DEPTH, type MergePartiesDeps, type OrgChartDepartment, type OrgChartPerson, type OrgChartPosition, type OrgStructureDeps, type PartyRefTable, type PaymentMethodIdInput, type RedeemPromoCodeInput, type RemoveTenantDiscountInput, type SendEmailFn, type SetUserAppRolesInput, type StartTrialInput, type SuiteHomeData, type TeamContext, type TeamDeps, type TeamMemberInput, type TenantAppRow, type TenantInput$1 as TenantInput, type UpdateBillingCustomerInput, type UpdateDepartmentInput, type UpdateMyDefaultTenantInput, type UpdateMyTimezoneInput, type UpdatePositionInput, type UpdateReferralStatusInput, type UpsertTeamMemberInput, accountResendInvitationServer, accountSendPasswordResetServer, accountUpdateUserProfileServer, addAppSubscriptionServer, addMockPaymentMethodServer, addMockReferralServer, canManageBillingFnServer, cancelSubscriptionServer, changeSubscriptionPlanServer, createArchiveParty, createCancelApp, createCleanupPartyContacts, createDeleteParty, createDeletePartyBankAccount, createDeletePartyContact, createDepartmentServer, createGetParty, createGetSuiteHome, createGetTenantSettings, createGetTenantUser, createHasEverHadMembership, createInvitePartyContact, createInviteTenantUser, createListMyAccessibleVendors, createListMyVendorTenants, createListNotifications, createListParties, createListPartyContacts, createListSuiteApps, createListTenantUsers, createMarkAllNotificationsRead, createMarkNotificationRead, createMergeParties, createPositionServer, createRemoveTenantUser, createResendInvitation, createRevokePartyContact, createSendPasswordResetLink, createSetAppUrl, createSetTenantUserStatus, createSubscribeApp, createUnarchiveParty, createUpdateTenantSettings, createUpdateTenantUserProfile, createUpdateTenantUserRoles, createUpsertParty, createUpsertPartyBankAccount, createUpsertPartyContact, deleteDepartmentServer, deletePositionServer, getBillingInvoiceServer, getBillingOverviewServer, getMyProfileServer, getOrgChartTreeServer, getReferralProgramServer, getTeamMemberServer, getTenantUsageServer, inviteUserToWorkspacesServer, listActiveBundleRulesServer, listAvailablePromotionsServer, listBillingInvoicesServer, listBillingPaymentMethodsServer, listBillingPlansServer, listDepartmentsAndPositionsServer, listManageableTenantsServer, listManageableUsersServer, listTeamMembersServer, listTenantDiscountsServer, reactivateSubscriptionServer, redeemPromoCodeServer, removeAppSubscriptionServer, removePaymentMethodServer, removeTenantDiscountServer, resolveScopedTenantIds, retryInvoicePaymentServer, seedSampleBillingInvoicesServer, setDefaultPaymentMethodServer, setUserAppRolesServer, startTrialServer, updateBillingCustomerServer, updateDepartmentServer, updateMyDefaultTenantServer, updateMyTimezoneServer, updatePositionServer, updateReferralStatusServer, upsertTeamMemberServer };
