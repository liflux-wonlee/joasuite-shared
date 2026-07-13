export { A as AppCode } from '../constants-B39zophS.js';
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
 * Shared Employee/Contractor Directory — basic identity + org-placement
 * fields ONLY (name, contact, department, position, manager, employment
 * status/dates, worker_type). Backed entirely by the shared core tables
 * `public.parties` (is_employee = true) and `public.employee_profiles`.
 *
 * Deliberately excludes every HR-confidential field (compensation,
 * contracts, emergency contact, performance reviews, leave/timesheet
 * records) — those remain app-owned (e.g. JoaOffice's
 * `office.employee_hr_records` / `office.employee_pto_balances`, gated by
 * their own role checks). This module must never import from, or grow a
 * dependency on, any app-specific HR schema — every JoaSuite app except
 * the future JoaHR app is expected to embed this same directory as-is.
 */
type EmployeeDirectoryDeps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
    assertCanReadEmployeeDirectory: (tenantId: string, userId: string) => Promise<void>;
    assertCanWriteEmployeeDirectory: (tenantId: string, userId: string) => Promise<void>;
    /** Called after a successful write, e.g. to append an audit_logs row. Optional. */
    onWrite?: (input: {
        tenantId: string;
        userId: string;
        partyId: string;
        created: boolean;
    }) => Promise<void>;
};
declare function createListEmployeeDirectory(deps: EmployeeDirectoryDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    search?: string | undefined;
}, Promise<{
    rows: any;
}>>;
declare function createGetEmployeeDirectoryEntry(deps: EmployeeDirectoryDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    party_id: string;
}, Promise<{
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
}>>;
/**
 * Create-or-update a directory entry. Accepts EITHER an existing `party_id`
 * (the common case for apps managing employees/contractors that have no
 * login — e.g. JoaOffice) OR a `linked_user_id` (the common case for
 * resolving/creating the employee record tied to an existing tenant login —
 * e.g. JoaSOP's Users detail page), OR neither for a brand-new directory
 * entry created from scratch (name/contact fields required in that case).
 *
 * Always leaves both a `parties` row (is_employee = true) and a matching
 * `employee_profiles` row in place — this is the fix for the historical gap
 * where creating a party alone (e.g. via a Parties/Vendors admin screen)
 * never created the accompanying employee_profiles row.
 */
declare function createUpsertEmployeeDirectoryEntry(deps: EmployeeDirectoryDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    worker_type: "employee" | "contractor";
    party_id?: string | undefined;
    linked_user_id?: string | undefined;
    name_en?: string | undefined;
    contact_email?: string | null | undefined;
    contact_phone?: string | null | undefined;
    department_id?: string | null | undefined;
    position_id?: string | null | undefined;
    manager_id?: string | null | undefined;
    employment_status?: "active" | "on_leave" | "terminated" | undefined;
    hire_date?: string | null | undefined;
    termination_date?: string | null | undefined;
}, Promise<{
    party_id: string;
    created: boolean;
}>>;

/**
 * Departments/positions are shared JoaSuite core tables (used by every app
 * that manages an Employee/Contractor Directory entry). Authorization is
 * intentionally injected rather than hardcoded here, since "who may edit
 * org structure" differs per app (e.g. JoaSOP's `sop_admin` vs JoaOffice's
 * `admin`/`hr_manager`) — see docs/joasuite-app-integration-contract.md.
 */
type OrgStructureDeps = {
    requireSupabaseAuth: any;
    supabaseAdmin: any;
    /** Read-gate: any tenant member who may see the org structure. */
    assertCanReadOrgStructure: (tenantId: string, userId: string) => Promise<void>;
    /** Write-gate: who may create/edit/delete departments and positions. */
    assertCanManageOrgStructure: (tenantId: string, userId: string) => Promise<void>;
};
declare function createListDepartmentsAndPositions(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
}, Promise<{
    departments: any;
    positions: any;
}>>;
declare function createCreateDepartment(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    name: string;
    code?: string | null | undefined;
}, Promise<{
    id: any;
}>>;
declare function createUpdateDepartment(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
    name: string;
    code?: string | null | undefined;
}, Promise<{
    ok: true;
}>>;
declare function createDeleteDepartment(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<{
    ok: true;
}>>;
declare function createCreatePosition(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    department_id: string;
    name: string;
}, Promise<{
    id: any;
}>>;
declare function createUpdatePosition(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
    name: string;
}, Promise<{
    ok: true;
}>>;
declare function createDeletePosition(deps: OrgStructureDeps): _tanstack_start_client_core.OptionalFetcher<readonly [any], (i: unknown) => {
    tenant_id: string;
    id: string;
}, Promise<{
    ok: true;
}>>;

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

declare const APP_CODES: readonly ["joabooks", "joasop", "joaoffice", "joaapproval", "joacrm", "joahr"];
declare const PLAN_CODES: readonly ["free", "basic", "pro", "business"];
declare const INTERVALS: readonly ["month", "year"];
type AppCode = (typeof APP_CODES)[number];
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

export { type AccountDeps, type AdminDeps, type AppCatalogEntry, APP_CODES as BILLING_APP_CODES, INTERVALS as BILLING_INTERVALS, PLAN_CODES as BILLING_PLAN_CODES, type AppCode as BillingAppCode, type BillingDeps, type BillingInterval, type PlanCode as BillingPlanCode, type EmployeeDirectoryDeps, type MergePartiesDeps, type OrgStructureDeps, type PartyRefTable, type SuiteHomeData, type TenantAppRow, createAccountResendInvitation, createAccountSendPasswordReset, createAccountUpdateUserProfile, createAddAppSubscription, createAddMockPaymentMethod, createAddMockReferral, createArchiveParty, createCanManageBillingFn, createCancelApp, createCancelSubscription, createChangeSubscriptionPlan, createCleanupPartyContacts, createCreateDepartment, createCreatePosition, createDeleteDepartment, createDeleteParty, createDeletePartyBankAccount, createDeletePartyContact, createDeletePosition, createGetBillingInvoice, createGetBillingOverview, createGetEmployeeDirectoryEntry, createGetMyProfile, createGetParty, createGetReferralProgram, createGetSuiteHome, createGetTenantSettings, createGetTenantUsage, createGetTenantUser, createInvitePartyContact, createInviteTenantUser, createInviteUserToWorkspaces, createListActiveBundleRules, createListAvailablePromotions, createListBillingInvoices, createListBillingPaymentMethods, createListBillingPlans, createListDepartmentsAndPositions, createListEmployeeDirectory, createListManageableTenants, createListManageableUsers, createListMyAccessibleVendors, createListMyVendorTenants, createListNotifications, createListParties, createListPartyContacts, createListSuiteApps, createListTenantDiscounts, createListTenantUsers, createMarkAllNotificationsRead, createMarkNotificationRead, createMergeParties, createReactivateSubscription, createRedeemPromoCode, createRemoveAppSubscription, createRemovePaymentMethod, createRemoveTenantDiscount, createRemoveTenantUser, createResendInvitation, createRetryInvoicePayment, createRevokePartyContact, createSeedSampleBillingInvoices, createSendPasswordResetLink, createSetAppUrl, createSetDefaultPaymentMethod, createSetTenantUserStatus, createSetUserAppRoles, createStartTrial, createSubscribeApp, createUnarchiveParty, createUpdateBillingCustomer, createUpdateDepartment, createUpdateMyDefaultTenant, createUpdateMyTimezone, createUpdatePosition, createUpdateReferralStatus, createUpdateTenantSettings, createUpdateTenantUserProfile, createUpdateTenantUserRoles, createUpsertEmployeeDirectoryEntry, createUpsertParty, createUpsertPartyBankAccount, createUpsertPartyContact, resolveScopedTenantIds };
