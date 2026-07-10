export { A as AppCode } from '../constants-CjPROrfF.js';
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
 * activity). Throws if any requested id is not an active membership, so a
 * client can never smuggle in an organization the caller doesn't belong to.
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
        portal: "approver" | "vendor" | "customer" | "internal";
        apps: {
            app_code: string;
            roles: ("owner" | "super_admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "admin" | "vendor" | "customer")[];
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
    roles: ("owner" | "super_admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "sop_admin" | "sop_author" | "sop_reviewer" | "sop_operator" | "admin" | "vendor" | "customer")[];
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
    /** Canonical app_code fallback for legacy rows predating multi-app support. */
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
    portal: "approver" | "vendor" | "customer" | "internal";
    roles: ("owner" | "super_admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "admin" | "vendor" | "customer")[];
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
    roles: ("owner" | "super_admin" | "finance_manager" | "finance_ap" | "finance_ar" | "accountant" | "approver" | "admin" | "vendor" | "customer")[];
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

export { type AccountDeps, type AdminDeps, type AppCatalogEntry, type MergePartiesDeps, type PartyRefTable, type SuiteHomeData, type TenantAppRow, createAccountResendInvitation, createAccountSendPasswordReset, createAccountUpdateUserProfile, createArchiveParty, createCancelApp, createCleanupPartyContacts, createDeleteParty, createDeletePartyBankAccount, createDeletePartyContact, createGetMyProfile, createGetParty, createGetSuiteHome, createGetTenantSettings, createGetTenantUser, createInvitePartyContact, createInviteTenantUser, createInviteUserToWorkspaces, createListManageableTenants, createListManageableUsers, createListMyAccessibleVendors, createListMyVendorTenants, createListNotifications, createListParties, createListPartyContacts, createListSuiteApps, createListTenantUsers, createMarkAllNotificationsRead, createMarkNotificationRead, createMergeParties, createRemoveTenantUser, createResendInvitation, createRevokePartyContact, createSendPasswordResetLink, createSetAppUrl, createSetTenantUserStatus, createSetUserAppRoles, createSubscribeApp, createUnarchiveParty, createUpdateMyDefaultTenant, createUpdateMyTimezone, createUpdateTenantSettings, createUpdateTenantUserProfile, createUpdateTenantUserRoles, createUpsertParty, createUpsertPartyBankAccount, createUpsertPartyContact, resolveScopedTenantIds };
