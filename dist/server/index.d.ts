export { A as AppCode, a as BILLING_APP_CODES, A as BillingAppCode } from '../constants-ME_hdmjZ.js';
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
    supabaseAdmin?: any;
    appCode?: string;
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
        kind: "payment_request" | "bill";
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
    supabaseAdmin?: any;
    appCode?: string;
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

type SendEmail$1 = (input: {
    to: string;
    subject: string;
    html: string;
}) => Promise<any>;
type AccountDeps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
    sendEmail: SendEmail$1;
    /** Fallback base URL used to build invite/reset links when APP_BASE_URL is unset, e.g. "https://books.joasuite.com". */
    appBaseUrl: string;
    /** Display name used in transactional emails, e.g. "JoaBooks". */
    appName: string;
    /** Canonical app_code, used as the fallback when a user_roles/app_code row predates multi-app support, e.g. "joabooks". */
    appCode: string;
};
declare function createListManageableTenants(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<any>>;
declare function createListManageableUsers(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<{
    tenants: [];
    users: [];
    caller_owner_tenant_ids?: undefined;
} | {
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
}>>;
declare function createInviteUserToWorkspaces(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    email: string;
    display_name: string;
    assignments: {
        tenant_id: string;
        portal: "approver" | "internal" | "vendor" | "customer";
        apps: {
            app_code: string;
            roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "billing_admin" | "vendor" | "customer" | "hr_manager" | "manager" | "employee")[];
        }[];
    }[];
    position?: string | undefined;
    primary_tenant_id?: string | undefined;
}, Promise<{
    user_id: any;
    created: boolean;
    tenants_added: number;
    primary_tenant_id: any;
    email: any;
}>>;
declare function createSetUserAppRoles(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    user_id: string;
    app_code: string;
    roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "billing_admin" | "vendor" | "customer" | "hr_manager" | "manager" | "employee")[];
}, Promise<{
    ok: true;
}>>;
declare function createAccountResendInvitation(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    user_id: string;
}, Promise<{
    ok: true;
    email: any;
}>>;
declare function createAccountSendPasswordReset(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    user_id: string;
}, Promise<{
    ok: true;
    email: any;
}>>;
declare function createAccountUpdateUserProfile(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    user_id: string;
    display_name: string;
    email?: string | undefined;
    position?: string | null | undefined;
}, Promise<{
    ok: true;
}>>;
declare function createGetMyProfile(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<{
    default_tenant_id: string | null;
    timezone: string | null;
}>>;
declare function createUpdateMyTimezone(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    timezone: string | null;
}, Promise<{
    ok: true;
}>>;
declare function createUpdateMyDefaultTenant(deps: AccountDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string | null;
}, Promise<{
    ok: true;
}>>;

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
 * Team member read/write gates are hardcoded (not dependency-injected) --
 * per the original design intent, these must NOT diverge per app. Departments/
 * positions/org-chart authorization DOES vary per app (e.g. JoaSOP gates on
 * its own sop_admin/sop_author/sop_reviewer roles plus an active JoaSOP
 * subscription; JoaHR uses its own assertJoahrRole), so those take an
 * `OrgStructureDeps` gate pair injected by the caller.
 */
type TeamContext = {
    supabase: any;
    userId: string;
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
type TenantInput = {
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
declare function listTeamMembersServer(input: ListTeamMembersInput, context: TeamContext): Promise<{
    rows: any;
}>;
declare function getTeamMemberServer(input: TeamMemberInput, context: TeamContext): Promise<{
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
declare function upsertTeamMemberServer(input: UpsertTeamMemberInput, context: TeamContext, appCode?: string): Promise<{
    party_id: string;
    created: boolean;
}>;
declare function listDepartmentsAndPositionsServer(input: TenantInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
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
declare function getOrgChartTreeServer(input: TenantInput, context: TeamContext, deps: OrgStructureDeps): Promise<{
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
    roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "billing_admin" | "vendor" | "customer" | "hr_manager" | "manager" | "employee")[];
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
    roles: ("owner" | "super_admin" | "admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "billing_admin" | "vendor" | "customer" | "hr_manager" | "manager" | "employee")[];
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

declare const PLAN_CODES: readonly ["free", "basic", "pro", "business"];
declare const INTERVALS: readonly ["month", "year"];
type PlanCode = (typeof PLAN_CODES)[number];
type BillingInterval = (typeof INTERVALS)[number];
type BillingDeps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
};
declare function createCanManageBillingFn(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    can_manage: boolean;
    can_view: boolean;
    roles: string[];
}>>;
declare function createGetBillingOverview(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    tenant: any;
    customer: any;
    subscriptions: any;
    default_payment_method: any;
    next_invoice_estimate_cents: number;
    roles: string[];
    can_manage: boolean;
    can_view: boolean;
}>>;
declare function createUpdateBillingCustomer(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    billing_email?: string | null | undefined;
    company_legal_name?: string | null | undefined;
    tax_id?: string | null | undefined;
    address_line1?: string | null | undefined;
    address_line2?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    postal_code?: string | null | undefined;
    country?: string | null | undefined;
    default_currency?: string | undefined;
    billing_phone?: string | null | undefined;
    billing_contact_name?: string | null | undefined;
    billing_contact_email?: string | null | undefined;
    invoice_memo?: string | null | undefined;
}, Promise<any>>;
declare function createListBillingPlans(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<undefined, (i: unknown) => {
    app_code?: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr" | undefined;
    interval?: "month" | "year" | undefined;
}, Promise<any>>;
declare function createChangeSubscriptionPlan(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
    plan_code: "basic" | "business" | "free" | "pro";
    interval: "month" | "year";
    seats: number;
}, Promise<{
    ok: true;
    mock: true;
    subscription: any;
}>>;
declare function createCancelSubscription(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
    at_period_end: boolean;
}, Promise<{
    ok: true;
    mock: true;
    subscription: any;
}>>;
declare function createListBillingInvoices(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    limit: number;
}, Promise<any>>;
declare function createGetBillingInvoice(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<any>>;
declare function createRetryInvoicePayment(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<{
    ok: false;
    mock: true;
    message: "Stripe integration coming later";
}>>;
declare function createSeedSampleBillingInvoices(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    ok: true;
    inserted: 0;
    skipped: true;
} | {
    ok: true;
    inserted: number;
    skipped?: undefined;
}>>;
declare function createListBillingPaymentMethods(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createAddMockPaymentMethod(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    make_default: boolean;
}, Promise<any>>;
declare function createSetDefaultPaymentMethod(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<{
    ok: true;
}>>;
declare function createRemovePaymentMethod(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<{
    ok: true;
}>>;
declare function createStartTrial(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
    plan_code: "basic" | "business" | "free" | "pro";
    interval: "month" | "year";
    trial_days: number;
}, Promise<{
    ok: true;
    mock: true;
    subscription: any;
}>>;
declare function createReactivateSubscription(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
}, Promise<{
    ok: true;
    mock: true;
    subscription: any;
}>>;
declare function createAddAppSubscription(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
    plan_code: "basic" | "business" | "free" | "pro";
    interval: "month" | "year";
}, Promise<{
    ok: true;
    mock: true;
    subscription: any;
}>>;
declare function createRemoveAppSubscription(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    app_code: "joabooks" | "joaapproval" | "joacrm" | "joaoffice" | "joasop" | "joahr";
}, Promise<{
    ok: true;
    mock: true;
}>>;
declare function createListAvailablePromotions(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createListTenantDiscounts(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<any>>;
declare function createRedeemPromoCode(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    code: string;
}, Promise<{
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
}>>;
declare function createRemoveTenantDiscount(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    discount_id: string;
}, Promise<{
    ok: true;
}>>;
declare function createGetReferralProgram(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    program: any;
    referrals: any;
}>>;
declare function createAddMockReferral(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    referee_email: string;
    status: "pending" | "signed_up" | "subscribed";
    referee_org_name?: string | undefined;
}, Promise<{
    ok: true;
    referral: any;
}>>;
declare function createUpdateReferralStatus(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    referral_id: string;
    status: "canceled" | "pending" | "signed_up" | "subscribed";
}, Promise<{
    ok: true;
}>>;
type PlanLimits = {
    users: number | null;
    customers: number | null;
    invoices_per_month: number | null;
    storage_gb: number | null;
    projects: number | null;
    attachments: number | null;
};
declare function createGetTenantUsage(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (data: {
    tenant_id: string;
    app_code?: string;
}) => {
    tenant_id: string;
    app_code?: string;
}, Promise<{
    app_code: any;
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
        projects: 0;
    };
}>>;
declare function createListActiveBundleRules(deps: BillingDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], undefined, Promise<any>>;

export { type AccountDeps, type AdminDeps, type AppCatalogEntry, INTERVALS as BILLING_INTERVALS, PLAN_CODES as BILLING_PLAN_CODES, type BillingDeps, type BillingInterval, type PlanCode as BillingPlanCode, type CreateDepartmentInput, type CreatePositionInput, type DeleteDepartmentInput, type DeletePositionInput, type ListTeamMembersInput, MAX_DEPARTMENT_DEPTH, type MergePartiesDeps, type OrgChartDepartment, type OrgChartPerson, type OrgChartPosition, type OrgStructureDeps, type PartyRefTable, type SuiteHomeData, type TeamContext, type TeamMemberInput, type TenantAppRow, type TenantInput, type UpdateDepartmentInput, type UpdatePositionInput, type UpsertTeamMemberInput, createAccountResendInvitation, createAccountSendPasswordReset, createAccountUpdateUserProfile, createAddAppSubscription, createAddMockPaymentMethod, createAddMockReferral, createArchiveParty, createCanManageBillingFn, createCancelApp, createCancelSubscription, createChangeSubscriptionPlan, createCleanupPartyContacts, createDeleteParty, createDeletePartyBankAccount, createDeletePartyContact, createDepartmentServer, createGetBillingInvoice, createGetBillingOverview, createGetMyProfile, createGetParty, createGetReferralProgram, createGetSuiteHome, createGetTenantSettings, createGetTenantUsage, createGetTenantUser, createHasEverHadMembership, createInvitePartyContact, createInviteTenantUser, createInviteUserToWorkspaces, createListActiveBundleRules, createListAvailablePromotions, createListBillingInvoices, createListBillingPaymentMethods, createListBillingPlans, createListManageableTenants, createListManageableUsers, createListMyAccessibleVendors, createListMyVendorTenants, createListNotifications, createListParties, createListPartyContacts, createListSuiteApps, createListTenantDiscounts, createListTenantUsers, createMarkAllNotificationsRead, createMarkNotificationRead, createMergeParties, createPositionServer, createReactivateSubscription, createRedeemPromoCode, createRemoveAppSubscription, createRemovePaymentMethod, createRemoveTenantDiscount, createRemoveTenantUser, createResendInvitation, createRetryInvoicePayment, createRevokePartyContact, createSeedSampleBillingInvoices, createSendPasswordResetLink, createSetAppUrl, createSetDefaultPaymentMethod, createSetTenantUserStatus, createSetUserAppRoles, createStartTrial, createSubscribeApp, createUnarchiveParty, createUpdateBillingCustomer, createUpdateMyDefaultTenant, createUpdateMyTimezone, createUpdateReferralStatus, createUpdateTenantSettings, createUpdateTenantUserProfile, createUpdateTenantUserRoles, createUpsertParty, createUpsertPartyBankAccount, createUpsertPartyContact, deleteDepartmentServer, deletePositionServer, getOrgChartTreeServer, getTeamMemberServer, listDepartmentsAndPositionsServer, listTeamMembersServer, resolveScopedTenantIds, updateDepartmentServer, updatePositionServer, upsertTeamMemberServer };
