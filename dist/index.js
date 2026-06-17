import { createContext, useContext, useState, useEffect } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { Moon, Sun, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/constants.ts
var APP_CODES = ["joabooks", "joaapproval", "joacrm", "joaoffice", "joasop"];
var APP_DISPLAY = [
  { code: "joabooks", name: "JoaBooks", description: "Finance \u2014 AP, AR, expenses, ledger" },
  { code: "joaapproval", name: "JoaApproval", description: "Cross-app approval inbox" },
  { code: "joacrm", name: "JoaCRM", description: "Customer relationships" },
  { code: "joaoffice", name: "JoaOffice", description: "Admin, assets, contracts" },
  { code: "joasop", name: "JoaSOP", description: "Policies, SOPs, training" }
];
var DEFAULT_APP_URLS = {
  joabooks: "https://books.joasuite.com",
  joaapproval: "https://approval.joasuite.com",
  joacrm: "https://crm.joasuite.com",
  joaoffice: "https://office.joasuite.com",
  joasop: "https://sop.joasuite.com"
};
var ROLES_BY_APP = {
  joabooks: [
    "owner",
    "super_admin",
    "finance_manager",
    "finance_ap",
    "finance_ar",
    "accountant",
    "approver"
  ],
  joasop: ["sop_admin", "sop_author", "sop_reviewer", "sop_operator"],
  joaoffice: ["owner", "super_admin", "approver"],
  joaapproval: ["owner", "super_admin", "approver"],
  joacrm: ["owner", "super_admin", "approver"]
};
var SETTINGS_KV_APP_URL_KEYS = APP_CODES.map((c) => `app_url.${c}`);
var JoaSuiteContext = createContext(null);
function JoaSuiteProvider({
  value,
  children
}) {
  return /* @__PURE__ */ jsx(JoaSuiteContext.Provider, { value, children });
}
function useJoaSuite() {
  const v = useContext(JoaSuiteContext);
  if (!v) {
    throw new Error(
      "@joasuite/shared-ui: useJoaSuite called outside <JoaSuiteProvider>. Wrap your app root with JoaSuiteProvider and pass the required adapters."
    );
  }
  return v;
}

// src/i18n/en.json
var en_default = {
  account: {
    title: "Account",
    back_to_app: "Back to app",
    display_name: "Display name",
    language: "Language",
    profile_desc: "Update your name and preferred language.",
    email_change_hint: "To change your sign-in email, use the Security tab.",
    security_desc: "Manage your sign-in email and password.",
    change_email: "Change email",
    current_email: "Current email",
    new_email: "New email",
    email_change_sent: "Confirmation email sent. Check your inbox.",
    change_password: "Change password",
    new_password: "New password",
    confirm_password: "Confirm password",
    password_too_short: "Password must be at least 8 characters.",
    password_mismatch: "Passwords do not match.",
    password_changed: "Password updated.",
    billing_desc: "Billing is currently per organization.",
    billing_per_org_note: "Each organization has its own plan and billing. Manage plans on the Organizations page.",
    go_to_organizations: "Go to Organizations",
    nav: {
      profile: "Profile",
      security: "Security",
      organizations: "Organizations",
      people: "People",
      billing: "Billing"
    },
    people: {
      desc: "Manage users across all organizations where you are owner or super admin.",
      invite: "Invite user",
      invite_title: "Invite a user to one or more organizations",
      choose_orgs: "Select organizations and roles",
      invite_hint: "If the email already exists on JoaBooks, they will be added silently. New users receive a single invitation email listing all selected organizations.",
      send_invite: "Send invitation",
      invited: "Invited to {{count}} organization(s)",
      added_existing: "Added existing user to {{count}} organization(s)",
      no_manageable_tenants: "You don't own or super-admin any organizations yet."
    }
  },
  bell: {
    title: "Notifications",
    mark_all_read: "Mark all read",
    no_notifications: "No notifications.",
    aria: "Notifications"
  },
  common: {
    submit: "Submit",
    save: "Save",
    cancel: "Cancel",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    loading: "Loading\u2026",
    actions: "Actions",
    status: "Status",
    amount: "Amount",
    date: "Date",
    note: "Note",
    back: "Back",
    no_active_workspace: "No active workspace.",
    logout: "Sign out",
    signin: "Sign in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    language: "Language",
    english: "English",
    chinese: "\u4E2D\u6587",
    search: "Search",
    all: "All",
    yes: "Yes",
    no: "No",
    new: "New",
    edit: "Edit"
  },
  set: {
    workspace: "Workspace",
    workspace_name: "Workspace name",
    doc_numbering: "Document numbering",
    doc_numbering_help: "Use {{yyyy}} for year and {{seq}} for the zero-padded sequence.",
    workflow: "Workflow",
    mtx_requires_approval: "Manual transactions require approval",
    save_changes: "Save changes",
    saving: "Saving\u2026",
    settings_saved: "Settings saved",
    members_roles: "Members & roles",
    invite_user: "Invite user",
    invite_a_user: "Invite a user",
    display_name_optional: "Display name",
    portal: "Portal",
    internal_staff: "Internal staff",
    approver: "Approver",
    primary_role: "Primary role",
    send_invite: "Send invite",
    sending: "Sending\u2026",
    invitation_sent: "Invitation sent",
    added_existing_user: "Added {{email}} to this workspace",
    already_member: "{{email}} is already a member of this workspace",
    invite_hint_existing: "If the user already has an account, they'll be added directly without an email.",
    user: "User",
    roles_label: "Roles",
    no_members: "No members yet.",
    suspend: "Suspend",
    activate: "Activate",
    roles_updated: "Roles updated",
    remove_user: "Remove from workspace",
    remove_user_confirm: "Remove {{name}} from this workspace? Their past records (audit log, approvals) remain, but they will lose access immediately.",
    user_removed: "User removed from workspace",
    cannot_remove_self: "You cannot remove yourself. Use 'Leave organization' instead.",
    cannot_remove_owner: "Cannot remove an owner. Transfer ownership first.",
    notifications_help: "Configure who is notified for each document event and the default approver chain for new documents.",
    on_submit: "On submit",
    fully_approved: "Fully approved",
    paid_event: "Paid",
    default_approver_chain: "Default approver chain",
    no_internal_members: "No internal members.",
    no_approvers_configured: "No approvers configured.",
    add_approver: "+ Add approver\u2026",
    remove: "Remove",
    notif_saved: "Notification rules saved",
    vendors: "Vendors",
    add_vendor: "Add vendor",
    new_vendor: "New vendor",
    legal_name_en: "Legal name (EN)",
    nick_name: "Nick name",
    contact_name: "Contact name",
    contact_phone: "Contact phone",
    contact_email: "Contact email",
    invite_to_portal_label: "Invite this vendor to the vendor portal",
    vendor: "Vendor",
    contact: "Contact",
    portal_access: "Portal access",
    no_vendors: "No vendors yet.",
    linked: "Linked",
    not_linked: "Not linked",
    invite_to_portal: "Invite to portal",
    vendor_saved: "Vendor saved",
    vendor_invited: "Vendor invited",
    categories: "Transaction categories",
    new_category: "New category",
    edit_category: "Edit category",
    name: "Name",
    type: "Type",
    sort_order: "Sort order",
    active: "Active",
    inactive: "inactive",
    edit: "Edit",
    category_saved: "Category saved",
    pm_title: "Payment methods",
    new_method: "New method",
    edit_method: "Edit payment method",
    new_pm: "New payment method",
    code: "Code",
    label: "Label",
    code_hint: "Lowercase letters, numbers, and underscores only.",
    pa_title: "Payment accounts",
    pa_help: "Internal bank, cash, and credit card accounts used to pay or receive funds.",
    add_account: "Add account",
    edit_account: "Edit account",
    add_payment_account: "Add payment account",
    account_name: "Account name",
    bank_name: "Bank name",
    last4: "Last 4",
    opening_balance: "Opening balance (USD)",
    description: "Description",
    current_balance: "Current balance",
    no_accounts: "No accounts yet.",
    deactivate: "Deactivate",
    account_added: "Account added",
    account_updated: "Account updated",
    currencies: "Currencies",
    currencies_title: "Currencies",
    new_currency: "New currency",
    edit_currency: "Edit currency",
    currency_code: "Code (USD, KRW, \u2026)",
    currency_symbol: "Symbol",
    subscription: "Subscription"
  }
};

// src/i18n/ko.json
var ko_default = {
  account: {
    title: "\uACC4\uC815",
    back_to_app: "\uC571\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30",
    display_name: "\uD45C\uC2DC \uC774\uB984",
    language: "\uC5B8\uC5B4",
    profile_desc: "\uC774\uB984\uACFC \uAE30\uBCF8 \uC5B8\uC5B4\uB97C \uC124\uC815\uD569\uB2C8\uB2E4.",
    email_change_hint: "\uB85C\uADF8\uC778 \uC774\uBA54\uC77C\uC744 \uBC14\uAFB8\uB824\uBA74 \uBCF4\uC548 \uD0ED\uC744 \uC774\uC6A9\uD558\uC138\uC694.",
    security_desc: "\uB85C\uADF8\uC778 \uC774\uBA54\uC77C\uACFC \uBE44\uBC00\uBC88\uD638\uB97C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
    change_email: "\uC774\uBA54\uC77C \uBCC0\uACBD",
    current_email: "\uD604\uC7AC \uC774\uBA54\uC77C",
    new_email: "\uC0C8 \uC774\uBA54\uC77C",
    email_change_sent: "\uD655\uC778 \uBA54\uC77C\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. \uBC1B\uC740\uD3B8\uC9C0\uD568\uC744 \uD655\uC778\uD558\uC138\uC694.",
    change_password: "\uBE44\uBC00\uBC88\uD638 \uBCC0\uACBD",
    new_password: "\uC0C8 \uBE44\uBC00\uBC88\uD638",
    confirm_password: "\uBE44\uBC00\uBC88\uD638 \uD655\uC778",
    password_too_short: "\uBE44\uBC00\uBC88\uD638\uB294 \uCD5C\uC18C 8\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.",
    password_mismatch: "\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
    password_changed: "\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    billing_desc: "\uACB0\uC81C\uB294 \uD604\uC7AC \uC870\uC9C1(Organization)\uBCC4\uB85C \uAD00\uB9AC\uB429\uB2C8\uB2E4.",
    billing_per_org_note: "\uAC01 \uC870\uC9C1\uB9C8\uB2E4 \uBCC4\uB3C4\uC758 \uD50C\uB79C\uACFC \uACB0\uC81C\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uC870\uC9C1 \uD398\uC774\uC9C0\uC5D0\uC11C \uAD00\uB9AC\uD558\uC138\uC694.",
    go_to_organizations: "\uC870\uC9C1\uC73C\uB85C \uC774\uB3D9",
    nav: {
      profile: "\uD504\uB85C\uD544",
      security: "\uBCF4\uC548",
      organizations: "\uC870\uC9C1",
      people: "\uC0AC\uC6A9\uC790",
      billing: "\uACB0\uC81C"
    },
    people: {
      desc: "\uB0B4\uAC00 owner \uB610\uB294 super admin\uC778 \uBAA8\uB4E0 \uC870\uC9C1\uC758 \uC0AC\uC6A9\uC790\uB97C \uAD00\uB9AC\uD569\uB2C8\uB2E4.",
      invite: "\uC0AC\uC6A9\uC790 \uCD08\uB300",
      invite_title: "\uC5EC\uB7EC \uC870\uC9C1\uC5D0 \uD55C \uBC88\uC5D0 \uC0AC\uC6A9\uC790 \uCD08\uB300",
      choose_orgs: "\uC870\uC9C1\uACFC \uC5ED\uD560 \uC120\uD0DD",
      invite_hint: "\uC774\uBBF8 \uB4F1\uB85D\uB41C \uC774\uBA54\uC77C\uC774\uBA74 \uBA54\uC77C \uC5C6\uC774 \uC989\uC2DC \uCD94\uAC00\uB429\uB2C8\uB2E4. \uC2E0\uADDC \uC0AC\uC6A9\uC790\uC5D0\uAC8C\uB294 \uC120\uD0DD\uD55C \uBAA8\uB4E0 \uC870\uC9C1\uC774 \uD45C\uC2DC\uB41C \uCD08\uB300 \uBA54\uC77C 1\uD1B5\uC774 \uBC1C\uC1A1\uB429\uB2C8\uB2E4.",
      send_invite: "\uCD08\uB300 \uBCF4\uB0B4\uAE30",
      invited: "{{count}}\uAC1C \uC870\uC9C1\uC5D0 \uCD08\uB300\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      added_existing: "\uAE30\uC874 \uC0AC\uC6A9\uC790\uB97C {{count}}\uAC1C \uC870\uC9C1\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4",
      no_manageable_tenants: "\uAD00\uB9AC \uAC00\uB2A5\uD55C \uC870\uC9C1(owner / super admin)\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
    }
  },
  bell: {
    title: "\uC54C\uB9BC",
    mark_all_read: "\uBAA8\uB450 \uC77D\uC74C \uCC98\uB9AC",
    no_notifications: "\uC54C\uB9BC\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
    aria: "\uC54C\uB9BC"
  },
  common: {
    submit: "\uC81C\uCD9C",
    save: "\uC800\uC7A5",
    cancel: "\uCDE8\uC18C",
    approve: "\uC2B9\uC778",
    reject: "\uAC70\uBD80",
    pending: "\uB300\uAE30 \uC911",
    loading: "\uB85C\uB529 \uC911\u2026",
    actions: "\uC791\uC5C5",
    status: "\uC0C1\uD0DC",
    amount: "\uAE08\uC561",
    date: "\uB0A0\uC9DC",
    note: "\uBA54\uBAA8",
    back: "\uB4A4\uB85C",
    no_active_workspace: "\uD65C\uC131 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
    logout: "\uB85C\uADF8\uC544\uC6C3",
    signin: "\uB85C\uADF8\uC778",
    signup: "\uD68C\uC6D0\uAC00\uC785",
    email: "\uC774\uBA54\uC77C",
    password: "\uBE44\uBC00\uBC88\uD638",
    language: "\uC5B8\uC5B4",
    english: "English",
    chinese: "\u4E2D\u6587",
    korean: "\uD55C\uAD6D\uC5B4",
    spanish: "Espa\xF1ol",
    vietnamese: "Ti\u1EBFng Vi\u1EC7t",
    search: "\uAC80\uC0C9",
    all: "\uC804\uCCB4",
    yes: "\uC608",
    no: "\uC544\uB2C8\uC624",
    new: "\uC0C8 \uD56D\uBAA9",
    edit: "\uD3B8\uC9D1"
  },
  set: {
    workspace: "\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4",
    workspace_name: "\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4 \uC774\uB984",
    doc_numbering: "\uBB38\uC11C \uBC88\uD638 \uADDC\uCE59",
    doc_numbering_help: "\uC5F0\uB3C4\uB294 {{yyyy}}, 0\uC73C\uB85C \uD328\uB529\uB41C \uC2DC\uD000\uC2A4\uB294 {{seq}}\uB97C \uC0AC\uC6A9\uD558\uC138\uC694.",
    workflow: "\uC6CC\uD06C\uD50C\uB85C\uC6B0",
    mtx_requires_approval: "\uC218\uAE30 \uAC70\uB798\uC5D0 \uC2B9\uC778 \uD544\uC694",
    save_changes: "\uBCC0\uACBD \uC0AC\uD56D \uC800\uC7A5",
    saving: "\uC800\uC7A5 \uC911\u2026",
    settings_saved: "\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    members_roles: "\uAD6C\uC131\uC6D0 \uBC0F \uAD8C\uD55C",
    invite_user: "\uC0AC\uC6A9\uC790 \uCD08\uB300",
    invite_a_user: "\uC0AC\uC6A9\uC790 \uCD08\uB300",
    display_name_optional: "\uD45C\uC2DC \uC774\uB984",
    portal: "\uD3EC\uD138",
    internal_staff: "\uB0B4\uBD80 \uC9C1\uC6D0",
    approver: "\uC2B9\uC778\uC790",
    primary_role: "\uAE30\uBCF8 \uC5ED\uD560",
    send_invite: "\uCD08\uB300 \uBCF4\uB0B4\uAE30",
    sending: "\uC804\uC1A1 \uC911\u2026",
    invitation_sent: "\uCD08\uB300\uB97C \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4",
    added_existing_user: "{{email}} \uB2D8\uC744 \uC774 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC5D0 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4",
    already_member: "{{email}} \uB2D8\uC740 \uC774\uBBF8 \uC774 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC758 \uBA64\uBC84\uC785\uB2C8\uB2E4",
    invite_hint_existing: "\uC774\uBBF8 \uAC00\uC785\uB41C \uC0AC\uC6A9\uC790\uB77C\uBA74 \uC774\uBA54\uC77C \uC5C6\uC774 \uBC14\uB85C \uC774 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC5D0 \uCD94\uAC00\uB429\uB2C8\uB2E4.",
    user: "\uC0AC\uC6A9\uC790",
    roles_label: "\uC5ED\uD560",
    no_members: "\uAD6C\uC131\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
    suspend: "\uC815\uC9C0",
    activate: "\uD65C\uC131\uD654",
    roles_updated: "\uC5ED\uD560\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    remove_user: "\uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC5D0\uC11C \uC81C\uAC70",
    remove_user_confirm: "{{name}} \uB2D8\uC744 \uC774 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC5D0\uC11C \uC81C\uAC70\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uACFC\uAC70 \uAE30\uB85D(\uAC10\uC0AC \uB85C\uADF8, \uC2B9\uC778 \uB4F1)\uC740 \uADF8\uB300\uB85C \uC720\uC9C0\uB418\uC9C0\uB9CC \uC989\uC2DC \uC811\uADFC \uAD8C\uD55C\uC744 \uC783\uC2B5\uB2C8\uB2E4.",
    user_removed: "\uC0AC\uC6A9\uC790\uAC00 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4\uC5D0\uC11C \uC81C\uAC70\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    cannot_remove_self: "\uBCF8\uC778\uC740 \uC81C\uAC70\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB300\uC2E0 '\uC870\uC9C1 \uB5A0\uB098\uAE30'\uB97C \uC0AC\uC6A9\uD558\uC138\uC694.",
    cannot_remove_owner: "\uC624\uB108\uB294 \uC81C\uAC70\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC18C\uC720\uAD8C\uC744 \uC774\uC804\uD558\uC138\uC694.",
    notifications_help: "\uAC01 \uBB38\uC11C \uC774\uBCA4\uD2B8\uC5D0 \uB300\uD55C \uC54C\uB9BC \uC218\uC2E0\uC790\uC640 \uAE30\uBCF8 \uC2B9\uC778 \uCCB4\uC778\uC744 \uAD6C\uC131\uD569\uB2C8\uB2E4.",
    on_submit: "\uC81C\uCD9C \uC2DC",
    fully_approved: "\uCD5C\uC885 \uC2B9\uC778",
    paid_event: "\uACB0\uC81C \uC644\uB8CC",
    default_approver_chain: "\uAE30\uBCF8 \uC2B9\uC778 \uCCB4\uC778",
    no_internal_members: "\uB0B4\uBD80 \uAD6C\uC131\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
    no_approvers_configured: "\uC2B9\uC778\uC790\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
    add_approver: "+ \uC2B9\uC778\uC790 \uCD94\uAC00\u2026",
    remove: "\uC81C\uAC70",
    notif_saved: "\uC54C\uB9BC \uADDC\uCE59\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    vendors: "\uACF5\uAE09\uC0AC",
    add_vendor: "\uACF5\uAE09\uC0AC \uCD94\uAC00",
    new_vendor: "\uC0C8 \uACF5\uAE09\uC0AC",
    legal_name_en: "\uBC95\uC778\uBA85 (\uC601\uBB38)",
    nick_name: "\uB2C9\uB124\uC784",
    contact_name: "\uB2F4\uB2F9\uC790 \uC774\uB984",
    contact_phone: "\uB2F4\uB2F9\uC790 \uC804\uD654",
    contact_email: "\uB2F4\uB2F9\uC790 \uC774\uBA54\uC77C",
    invite_to_portal_label: "\uC774 \uACF5\uAE09\uC0AC\uB97C \uACF5\uAE09\uC0AC \uD3EC\uD138\uB85C \uCD08\uB300",
    vendor: "\uACF5\uAE09\uC0AC",
    contact: "\uB2F4\uB2F9\uC790",
    portal_access: "\uD3EC\uD138 \uC811\uADFC",
    no_vendors: "\uACF5\uAE09\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
    linked: "\uC5F0\uACB0\uB428",
    not_linked: "\uBBF8\uC5F0\uACB0",
    invite_to_portal: "\uD3EC\uD138\uB85C \uCD08\uB300",
    vendor_saved: "\uACF5\uAE09\uC0AC\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    vendor_invited: "\uACF5\uAE09\uC0AC\uB97C \uCD08\uB300\uD588\uC2B5\uB2C8\uB2E4",
    categories: "\uAC70\uB798 \uCE74\uD14C\uACE0\uB9AC",
    new_category: "\uC0C8 \uCE74\uD14C\uACE0\uB9AC",
    edit_category: "\uCE74\uD14C\uACE0\uB9AC \uD3B8\uC9D1",
    name: "\uC774\uB984",
    type: "\uC720\uD615",
    sort_order: "\uC815\uB82C \uC21C\uC11C",
    active: "\uD65C\uC131",
    inactive: "\uBE44\uD65C\uC131",
    edit: "\uD3B8\uC9D1",
    category_saved: "\uCE74\uD14C\uACE0\uB9AC\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    pm_title: "\uACB0\uC81C \uC218\uB2E8",
    new_method: "\uC0C8 \uACB0\uC81C \uC218\uB2E8",
    edit_method: "\uACB0\uC81C \uC218\uB2E8 \uD3B8\uC9D1",
    new_pm: "\uC0C8 \uACB0\uC81C \uC218\uB2E8",
    code: "\uCF54\uB4DC",
    label: "\uD45C\uC2DC\uBA85",
    code_hint: "\uC18C\uBB38\uC790, \uC22B\uC790, \uBC11\uC904\uB9CC \uC0AC\uC6A9 \uAC00\uB2A5\uD569\uB2C8\uB2E4.",
    pa_title: "\uACB0\uC81C \uACC4\uC815",
    pa_help: "\uACB0\uC81C \uB610\uB294 \uC218\uAE08\uC5D0 \uC0AC\uC6A9\uB418\uB294 \uB0B4\uBD80 \uC740\uD589, \uD604\uAE08, \uC2E0\uC6A9\uCE74\uB4DC \uACC4\uC815.",
    add_account: "\uACC4\uC815 \uCD94\uAC00",
    edit_account: "\uACC4\uC815 \uD3B8\uC9D1",
    add_payment_account: "\uACB0\uC81C \uACC4\uC815 \uCD94\uAC00",
    account_name: "\uACC4\uC815 \uC774\uB984",
    bank_name: "\uC740\uD589 \uC774\uB984",
    last4: "\uB05D 4\uC790\uB9AC",
    opening_balance: "\uAE30\uCD08 \uC794\uC561 (USD)",
    description: "\uC124\uBA85",
    current_balance: "\uD604\uC7AC \uC794\uC561",
    no_accounts: "\uACC4\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
    deactivate: "\uBE44\uD65C\uC131\uD654",
    account_added: "\uACC4\uC815\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    account_updated: "\uACC4\uC815\uC774 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
    subscription: "\uAD6C\uB3C5"
  }
};

// src/i18n/zh.json
var zh_default = {
  account: {
    title: "\u8D26\u6237",
    back_to_app: "\u8FD4\u56DE\u5E94\u7528",
    display_name: "\u663E\u793A\u540D\u79F0",
    language: "\u8BED\u8A00",
    profile_desc: "\u66F4\u65B0\u60A8\u7684\u59D3\u540D\u548C\u9996\u9009\u8BED\u8A00\u3002",
    email_change_hint: "\u5982\u9700\u66F4\u6539\u767B\u5F55\u90AE\u7BB1\uFF0C\u8BF7\u4F7F\u7528\u300C\u5B89\u5168\u300D\u9009\u9879\u5361\u3002",
    security_desc: "\u7BA1\u7406\u60A8\u7684\u767B\u5F55\u90AE\u7BB1\u548C\u5BC6\u7801\u3002",
    change_email: "\u66F4\u6539\u90AE\u7BB1",
    current_email: "\u5F53\u524D\u90AE\u7BB1",
    new_email: "\u65B0\u90AE\u7BB1",
    email_change_sent: "\u786E\u8BA4\u90AE\u4EF6\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u6536\u3002",
    change_password: "\u4FEE\u6539\u5BC6\u7801",
    new_password: "\u65B0\u5BC6\u7801",
    confirm_password: "\u786E\u8BA4\u5BC6\u7801",
    password_too_short: "\u5BC6\u7801\u81F3\u5C11\u9700\u8981 8 \u4E2A\u5B57\u7B26\u3002",
    password_mismatch: "\u4E24\u6B21\u5BC6\u7801\u4E0D\u4E00\u81F4\u3002",
    password_changed: "\u5BC6\u7801\u5DF2\u66F4\u65B0\u3002",
    billing_desc: "\u76EE\u524D\u6309\u7EC4\u7EC7\u8BA1\u8D39\u3002",
    billing_per_org_note: "\u6BCF\u4E2A\u7EC4\u7EC7\u6709\u72EC\u7ACB\u7684\u65B9\u6848\u548C\u8D26\u5355\u3002\u8BF7\u5728\u300C\u7EC4\u7EC7\u300D\u9875\u9762\u7BA1\u7406\u3002",
    go_to_organizations: "\u524D\u5F80\u7EC4\u7EC7",
    nav: {
      profile: "\u4E2A\u4EBA\u8D44\u6599",
      security: "\u5B89\u5168",
      organizations: "\u7EC4\u7EC7",
      people: "\u6210\u5458",
      billing: "\u8D26\u5355"
    },
    people: {
      desc: "\u7BA1\u7406\u60A8\u4F5C\u4E3A\u6240\u6709\u8005\u6216\u8D85\u7EA7\u7BA1\u7406\u5458\u7684\u6240\u6709\u7EC4\u7EC7\u4E2D\u7684\u7528\u6237\u3002",
      invite: "\u9080\u8BF7\u7528\u6237",
      invite_title: "\u9080\u8BF7\u7528\u6237\u52A0\u5165\u4E00\u4E2A\u6216\u591A\u4E2A\u7EC4\u7EC7",
      choose_orgs: "\u9009\u62E9\u7EC4\u7EC7\u548C\u89D2\u8272",
      invite_hint: "\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u5B58\u5728\u4E8E JoaBooks\uFF0C\u5C06\u76F4\u63A5\u6DFB\u52A0\u3002\u65B0\u7528\u6237\u5C06\u6536\u5230\u4E00\u5C01\u5305\u542B\u6240\u6709\u6240\u9009\u7EC4\u7EC7\u7684\u9080\u8BF7\u90AE\u4EF6\u3002",
      send_invite: "\u53D1\u9001\u9080\u8BF7",
      invited: "\u5DF2\u9080\u8BF7\u52A0\u5165 {{count}} \u4E2A\u7EC4\u7EC7",
      added_existing: "\u5DF2\u5C06\u73B0\u6709\u7528\u6237\u6DFB\u52A0\u5230 {{count}} \u4E2A\u7EC4\u7EC7",
      no_manageable_tenants: "\u60A8\u8FD8\u6CA1\u6709\u4F5C\u4E3A\u6240\u6709\u8005\u6216\u8D85\u7EA7\u7BA1\u7406\u5458\u7684\u7EC4\u7EC7\u3002"
    }
  },
  bell: {
    title: "\u901A\u77E5",
    mark_all_read: "\u5168\u90E8\u6807\u8BB0\u4E3A\u5DF2\u8BFB",
    no_notifications: "\u65E0\u901A\u77E5\u3002",
    aria: "\u901A\u77E5"
  },
  common: {
    submit: "\u63D0\u4EA4",
    save: "\u4FDD\u5B58",
    cancel: "\u53D6\u6D88",
    approve: "\u6279\u51C6",
    reject: "\u62D2\u7EDD",
    pending: "\u5F85\u5B9A",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    actions: "\u64CD\u4F5C",
    status: "\u72B6\u6001",
    amount: "\u91D1\u989D",
    date: "\u65E5\u671F",
    note: "\u5907\u6CE8",
    back: "\u8FD4\u56DE",
    no_active_workspace: "\u6CA1\u6709\u6D3B\u52A8\u7684\u5DE5\u4F5C\u533A\u3002",
    logout: "\u9000\u51FA",
    signin: "\u767B\u5F55",
    signup: "\u6CE8\u518C",
    email: "\u90AE\u7BB1",
    password: "\u5BC6\u7801",
    language: "\u8BED\u8A00",
    english: "English",
    chinese: "\u4E2D\u6587",
    search: "\u641C\u7D22",
    all: "\u5168\u90E8",
    yes: "\u662F",
    no: "\u5426",
    new: "\u65B0",
    edit: "\u7F16\u8F91"
  },
  set: {
    workspace: "\u5DE5\u4F5C\u533A",
    workspace_name: "\u5DE5\u4F5C\u533A\u540D\u79F0",
    doc_numbering: "\u5355\u636E\u7F16\u53F7",
    doc_numbering_help: "\u4F7F\u7528 {{yyyy}} \u8868\u793A\u5E74\u4EFD\uFF0C{{seq}} \u8868\u793A\u8865\u96F6\u5E8F\u53F7\u3002",
    workflow: "\u5DE5\u4F5C\u6D41",
    mtx_requires_approval: "\u624B\u5DE5\u4EA4\u6613\u9700\u8981\u5BA1\u6279",
    save_changes: "\u4FDD\u5B58\u66F4\u6539",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    settings_saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
    members_roles: "\u6210\u5458\u4E0E\u89D2\u8272",
    invite_user: "\u9080\u8BF7\u7528\u6237",
    invite_a_user: "\u9080\u8BF7\u7528\u6237",
    display_name_optional: "\u663E\u793A\u540D\u79F0",
    portal: "\u95E8\u6237",
    internal_staff: "\u5185\u90E8\u5458\u5DE5",
    approver: "\u5BA1\u6279\u4EBA",
    primary_role: "\u4E3B\u8981\u89D2\u8272",
    send_invite: "\u53D1\u9001\u9080\u8BF7",
    sending: "\u53D1\u9001\u4E2D\u2026",
    invitation_sent: "\u9080\u8BF7\u5DF2\u53D1\u9001",
    added_existing_user: "\u5DF2\u5C06 {{email}} \u6DFB\u52A0\u5230\u6B64\u5DE5\u4F5C\u533A",
    already_member: "{{email}} \u5DF2\u7ECF\u662F\u6B64\u5DE5\u4F5C\u533A\u7684\u6210\u5458",
    invite_hint_existing: "\u5982\u679C\u7528\u6237\u5DF2\u6709\u8D26\u6237,\u5C06\u76F4\u63A5\u52A0\u5165\u6B64\u5DE5\u4F5C\u533A,\u4E0D\u53D1\u9001\u90AE\u4EF6\u3002",
    user: "\u7528\u6237",
    roles_label: "\u89D2\u8272",
    no_members: "\u6682\u65E0\u6210\u5458\u3002",
    suspend: "\u505C\u7528",
    activate: "\u6FC0\u6D3B",
    roles_updated: "\u89D2\u8272\u5DF2\u66F4\u65B0",
    remove_user: "\u4ECE\u5DE5\u4F5C\u533A\u79FB\u9664",
    remove_user_confirm: "\u786E\u5B9A\u8981\u5C06 {{name}} \u4ECE\u6B64\u5DE5\u4F5C\u533A\u79FB\u9664\u5417\uFF1F\u5176\u8FC7\u5F80\u8BB0\u5F55\uFF08\u5BA1\u8BA1\u65E5\u5FD7\u3001\u5BA1\u6279\u7B49\uFF09\u5C06\u4FDD\u7559\uFF0C\u4F46\u4F1A\u7ACB\u5373\u5931\u53BB\u8BBF\u95EE\u6743\u9650\u3002",
    user_removed: "\u7528\u6237\u5DF2\u4ECE\u5DE5\u4F5C\u533A\u79FB\u9664",
    cannot_remove_self: "\u65E0\u6CD5\u79FB\u9664\u81EA\u5DF1\u3002\u8BF7\u6539\u7528\u300C\u79BB\u5F00\u7EC4\u7EC7\u300D\u3002",
    cannot_remove_owner: "\u65E0\u6CD5\u79FB\u9664\u6240\u6709\u8005\u3002\u8BF7\u5148\u8F6C\u79FB\u6240\u6709\u6743\u3002",
    notifications_help: "\u914D\u7F6E\u6BCF\u4E2A\u5355\u636E\u4E8B\u4EF6\u7684\u901A\u77E5\u5BF9\u8C61\u548C\u65B0\u5355\u636E\u7684\u9ED8\u8BA4\u5BA1\u6279\u94FE\u3002",
    on_submit: "\u63D0\u4EA4\u65F6",
    fully_approved: "\u5168\u90E8\u901A\u8FC7",
    paid_event: "\u5DF2\u4ED8\u6B3E",
    default_approver_chain: "\u9ED8\u8BA4\u5BA1\u6279\u94FE",
    no_internal_members: "\u6682\u65E0\u5185\u90E8\u6210\u5458\u3002",
    no_approvers_configured: "\u672A\u914D\u7F6E\u5BA1\u6279\u4EBA\u3002",
    add_approver: "+ \u6DFB\u52A0\u5BA1\u6279\u4EBA\u2026",
    remove: "\u79FB\u9664",
    notif_saved: "\u901A\u77E5\u89C4\u5219\u5DF2\u4FDD\u5B58",
    vendors: "\u4F9B\u5E94\u5546",
    add_vendor: "\u6DFB\u52A0\u4F9B\u5E94\u5546",
    new_vendor: "\u65B0\u4F9B\u5E94\u5546",
    legal_name_en: "\u6CD5\u5B9A\u540D\u79F0\uFF08\u82F1\u6587\uFF09",
    nick_name: "\u6635\u79F0",
    contact_name: "\u8054\u7CFB\u4EBA\u59D3\u540D",
    contact_phone: "\u8054\u7CFB\u7535\u8BDD",
    contact_email: "\u8054\u7CFB\u90AE\u7BB1",
    invite_to_portal_label: "\u9080\u8BF7\u6B64\u4F9B\u5E94\u5546\u4F7F\u7528\u4F9B\u5E94\u5546\u95E8\u6237",
    vendor: "\u4F9B\u5E94\u5546",
    contact: "\u8054\u7CFB\u4EBA",
    portal_access: "\u95E8\u6237\u8BBF\u95EE",
    no_vendors: "\u6682\u65E0\u4F9B\u5E94\u5546\u3002",
    linked: "\u5DF2\u5173\u8054",
    not_linked: "\u672A\u5173\u8054",
    invite_to_portal: "\u9080\u8BF7\u81F3\u95E8\u6237",
    vendor_saved: "\u4F9B\u5E94\u5546\u5DF2\u4FDD\u5B58",
    vendor_invited: "\u4F9B\u5E94\u5546\u5DF2\u9080\u8BF7",
    categories: "\u4EA4\u6613\u7C7B\u522B",
    new_category: "\u65B0\u5EFA\u7C7B\u522B",
    edit_category: "\u7F16\u8F91\u7C7B\u522B",
    name: "\u540D\u79F0",
    type: "\u7C7B\u578B",
    sort_order: "\u6392\u5E8F",
    active: "\u542F\u7528",
    inactive: "\u505C\u7528",
    edit: "\u7F16\u8F91",
    category_saved: "\u7C7B\u522B\u5DF2\u4FDD\u5B58",
    pm_title: "\u4ED8\u6B3E\u65B9\u5F0F",
    new_method: "\u65B0\u5EFA\u65B9\u5F0F",
    edit_method: "\u7F16\u8F91\u4ED8\u6B3E\u65B9\u5F0F",
    new_pm: "\u65B0\u5EFA\u4ED8\u6B3E\u65B9\u5F0F",
    code: "\u4EE3\u7801",
    label: "\u540D\u79F0",
    code_hint: "\u4EC5\u5141\u8BB8\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF\u3002",
    pa_title: "\u4ED8\u6B3E\u8D26\u6237",
    pa_help: "\u7528\u4E8E\u4ED8\u6B3E\u6216\u6536\u6B3E\u7684\u5185\u90E8\u94F6\u884C\u3001\u73B0\u91D1\u548C\u4FE1\u7528\u5361\u8D26\u6237\u3002",
    add_account: "\u6DFB\u52A0\u8D26\u6237",
    edit_account: "\u7F16\u8F91\u8D26\u6237",
    add_payment_account: "\u6DFB\u52A0\u4ED8\u6B3E\u8D26\u6237",
    account_name: "\u8D26\u6237\u540D\u79F0",
    bank_name: "\u94F6\u884C\u540D\u79F0",
    last4: "\u672B4\u4F4D",
    opening_balance: "\u671F\u521D\u4F59\u989D\uFF08USD\uFF09",
    description: "\u63CF\u8FF0",
    current_balance: "\u5F53\u524D\u4F59\u989D",
    no_accounts: "\u6682\u65E0\u8D26\u6237\u3002",
    deactivate: "\u505C\u7528",
    account_added: "\u8D26\u6237\u5DF2\u6DFB\u52A0",
    account_updated: "\u8D26\u6237\u5DF2\u66F4\u65B0",
    subscription: "\u8BA2\u9605"
  }
};

// src/i18n/es.json
var es_default = {
  account: {
    title: "Cuenta",
    back_to_app: "Volver a la app",
    display_name: "Nombre visible",
    language: "Idioma",
    profile_desc: "Actualiza tu nombre y el idioma preferido.",
    email_change_hint: "Para cambiar el correo de inicio de sesi\xF3n, usa la pesta\xF1a Seguridad.",
    security_desc: "Gestiona tu correo y contrase\xF1a de inicio de sesi\xF3n.",
    change_email: "Cambiar correo",
    current_email: "Correo actual",
    new_email: "Nuevo correo",
    email_change_sent: "Correo de confirmaci\xF3n enviado. Revisa tu bandeja.",
    change_password: "Cambiar contrase\xF1a",
    new_password: "Nueva contrase\xF1a",
    confirm_password: "Confirmar contrase\xF1a",
    password_too_short: "La contrase\xF1a debe tener al menos 8 caracteres.",
    password_mismatch: "Las contrase\xF1as no coinciden.",
    password_changed: "Contrase\xF1a actualizada.",
    billing_desc: "La facturaci\xF3n es por organizaci\xF3n.",
    billing_per_org_note: "Cada organizaci\xF3n tiene su propio plan y facturaci\xF3n. Gesti\xF3nalos en Organizaciones.",
    go_to_organizations: "Ir a Organizaciones",
    nav: {
      profile: "Perfil",
      security: "Seguridad",
      organizations: "Organizaciones",
      people: "Personas",
      billing: "Facturaci\xF3n"
    },
    people: {
      desc: "Gestiona usuarios en todas las organizaciones donde eres propietario o super admin.",
      invite: "Invitar usuario",
      invite_title: "Invitar a un usuario a una o varias organizaciones",
      choose_orgs: "Selecciona organizaciones y roles",
      invite_hint: "Si el correo ya existe en JoaBooks, se a\xF1adir\xE1 sin notificaci\xF3n. Los usuarios nuevos reciben un \xFAnico correo con todas las organizaciones seleccionadas.",
      send_invite: "Enviar invitaci\xF3n",
      invited: "Invitado a {{count}} organizaci\xF3n(es)",
      added_existing: "Usuario existente a\xF1adido a {{count}} organizaci\xF3n(es)",
      no_manageable_tenants: "A\xFAn no eres propietario ni super admin de ninguna organizaci\xF3n."
    }
  },
  bell: {
    title: "Notificaciones",
    mark_all_read: "Marcar todo como le\xEDdo",
    no_notifications: "Sin notificaciones.",
    aria: "Notificaciones"
  },
  common: {
    submit: "Enviar",
    save: "Guardar",
    cancel: "Cancelar",
    approve: "Aprobar",
    reject: "Rechazar",
    pending: "Pendiente",
    loading: "Cargando\u2026",
    actions: "Acciones",
    status: "Estado",
    amount: "Monto",
    date: "Fecha",
    note: "Nota",
    back: "Volver",
    no_active_workspace: "No hay espacio de trabajo activo.",
    logout: "Cerrar sesi\xF3n",
    signin: "Iniciar sesi\xF3n",
    signup: "Registrarse",
    email: "Correo electr\xF3nico",
    password: "Contrase\xF1a",
    language: "Idioma",
    english: "English",
    chinese: "\u4E2D\u6587",
    korean: "\uD55C\uAD6D\uC5B4",
    spanish: "Espa\xF1ol",
    vietnamese: "Ti\u1EBFng Vi\u1EC7t",
    search: "Buscar",
    all: "Todos",
    yes: "S\xED",
    no: "No",
    new: "Nuevo",
    edit: "Editar"
  },
  set: {
    workspace: "Espacio de trabajo",
    workspace_name: "Nombre del espacio",
    doc_numbering: "Numeraci\xF3n de documentos",
    doc_numbering_help: "Usa {{yyyy}} para el a\xF1o y {{seq}} para la secuencia rellenada con ceros.",
    workflow: "Flujo de trabajo",
    mtx_requires_approval: "Las transacciones manuales requieren aprobaci\xF3n",
    save_changes: "Guardar cambios",
    saving: "Guardando\u2026",
    settings_saved: "Configuraci\xF3n guardada",
    members_roles: "Miembros y roles",
    invite_user: "Invitar usuario",
    invite_a_user: "Invitar a un usuario",
    display_name_optional: "Nombre a mostrar",
    portal: "Portal",
    internal_staff: "Personal interno",
    approver: "Aprobador",
    primary_role: "Rol principal",
    send_invite: "Enviar invitaci\xF3n",
    sending: "Enviando\u2026",
    invitation_sent: "Invitaci\xF3n enviada",
    added_existing_user: "Se a\xF1adi\xF3 {{email}} a este espacio de trabajo",
    already_member: "{{email}} ya es miembro de este espacio de trabajo",
    invite_hint_existing: "Si el usuario ya tiene una cuenta, se a\xF1adir\xE1 directamente sin correo electr\xF3nico.",
    user: "Usuario",
    roles_label: "Roles",
    no_members: "A\xFAn no hay miembros.",
    suspend: "Suspender",
    activate: "Activar",
    roles_updated: "Roles actualizados",
    remove_user: "Quitar del espacio de trabajo",
    remove_user_confirm: "\xBFQuitar a {{name}} de este espacio de trabajo? Sus registros pasados (auditor\xEDa, aprobaciones) se mantienen, pero perder\xE1 el acceso de inmediato.",
    user_removed: "Usuario eliminado del espacio de trabajo",
    cannot_remove_self: "No puedes quitarte a ti mismo. Usa 'Salir de la organizaci\xF3n'.",
    cannot_remove_owner: "No se puede quitar a un propietario. Transfiere la propiedad primero.",
    notifications_help: "Configura qui\xE9n recibe notificaciones por cada evento y la cadena de aprobadores por defecto.",
    on_submit: "Al enviar",
    fully_approved: "Totalmente aprobado",
    paid_event: "Pagado",
    default_approver_chain: "Cadena de aprobadores por defecto",
    no_internal_members: "Sin miembros internos.",
    no_approvers_configured: "No hay aprobadores configurados.",
    add_approver: "+ A\xF1adir aprobador\u2026",
    remove: "Quitar",
    notif_saved: "Reglas de notificaci\xF3n guardadas",
    vendors: "Proveedores",
    add_vendor: "A\xF1adir proveedor",
    new_vendor: "Nuevo proveedor",
    legal_name_en: "Raz\xF3n social (EN)",
    nick_name: "Apodo",
    contact_name: "Nombre de contacto",
    contact_phone: "Tel\xE9fono de contacto",
    contact_email: "Email de contacto",
    invite_to_portal_label: "Invitar a este proveedor al portal de proveedores",
    vendor: "Proveedor",
    contact: "Contacto",
    portal_access: "Acceso al portal",
    no_vendors: "A\xFAn no hay proveedores.",
    linked: "Vinculado",
    not_linked: "No vinculado",
    invite_to_portal: "Invitar al portal",
    vendor_saved: "Proveedor guardado",
    vendor_invited: "Proveedor invitado",
    categories: "Categor\xEDas de transacci\xF3n",
    new_category: "Nueva categor\xEDa",
    edit_category: "Editar categor\xEDa",
    name: "Nombre",
    type: "Tipo",
    sort_order: "Orden",
    active: "Activo",
    inactive: "inactivo",
    edit: "Editar",
    category_saved: "Categor\xEDa guardada",
    pm_title: "M\xE9todos de pago",
    new_method: "Nuevo m\xE9todo",
    edit_method: "Editar m\xE9todo de pago",
    new_pm: "Nuevo m\xE9todo de pago",
    code: "C\xF3digo",
    label: "Etiqueta",
    code_hint: "Solo letras min\xFAsculas, n\xFAmeros y guiones bajos.",
    pa_title: "Cuentas de pago",
    pa_help: "Cuentas internas de banco, efectivo y tarjeta de cr\xE9dito para pagar o recibir fondos.",
    add_account: "A\xF1adir cuenta",
    edit_account: "Editar cuenta",
    add_payment_account: "A\xF1adir cuenta de pago",
    account_name: "Nombre de la cuenta",
    bank_name: "Banco",
    last4: "\xDAltimos 4",
    opening_balance: "Saldo inicial (USD)",
    description: "Descripci\xF3n",
    current_balance: "Saldo actual",
    no_accounts: "A\xFAn no hay cuentas.",
    deactivate: "Desactivar",
    account_added: "Cuenta a\xF1adida",
    account_updated: "Cuenta actualizada",
    subscription: "Suscripci\xF3n"
  }
};

// src/i18n/vi.json
var vi_default = {
  account: {
    title: "T\xE0i kho\u1EA3n",
    back_to_app: "Quay l\u1EA1i \u1EE9ng d\u1EE5ng",
    display_name: "T\xEAn hi\u1EC3n th\u1ECB",
    language: "Ng\xF4n ng\u1EEF",
    profile_desc: "C\u1EADp nh\u1EADt t\xEAn v\xE0 ng\xF4n ng\u1EEF \u01B0u ti\xEAn.",
    email_change_hint: "\u0110\u1EC3 \u0111\u1ED5i email \u0111\u0103ng nh\u1EADp, d\xF9ng tab B\u1EA3o m\u1EADt.",
    security_desc: "Qu\u1EA3n l\xFD email \u0111\u0103ng nh\u1EADp v\xE0 m\u1EADt kh\u1EA9u.",
    change_email: "\u0110\u1ED5i email",
    current_email: "Email hi\u1EC7n t\u1EA1i",
    new_email: "Email m\u1EDBi",
    email_change_sent: "\u0110\xE3 g\u1EEDi email x\xE1c nh\u1EADn. Vui l\xF2ng ki\u1EC3m tra h\u1ED9p th\u01B0.",
    change_password: "\u0110\u1ED5i m\u1EADt kh\u1EA9u",
    new_password: "M\u1EADt kh\u1EA9u m\u1EDBi",
    confirm_password: "X\xE1c nh\u1EADn m\u1EADt kh\u1EA9u",
    password_too_short: "M\u1EADt kh\u1EA9u ph\u1EA3i c\xF3 \xEDt nh\u1EA5t 8 k\xFD t\u1EF1.",
    password_mismatch: "M\u1EADt kh\u1EA9u kh\xF4ng kh\u1EDBp.",
    password_changed: "\u0110\xE3 c\u1EADp nh\u1EADt m\u1EADt kh\u1EA9u.",
    billing_desc: "Thanh to\xE1n hi\u1EC7n theo t\u1ED5 ch\u1EE9c.",
    billing_per_org_note: "M\u1ED7i t\u1ED5 ch\u1EE9c c\xF3 g\xF3i v\xE0 thanh to\xE1n ri\xEAng. Qu\u1EA3n l\xFD t\u1EA1i trang T\u1ED5 ch\u1EE9c.",
    go_to_organizations: "\u0110\u1EBFn T\u1ED5 ch\u1EE9c",
    nav: {
      profile: "H\u1ED3 s\u01A1",
      security: "B\u1EA3o m\u1EADt",
      organizations: "T\u1ED5 ch\u1EE9c",
      people: "Th\xE0nh vi\xEAn",
      billing: "Thanh to\xE1n"
    },
    people: {
      desc: "Qu\u1EA3n l\xFD ng\u01B0\u1EDDi d\xF9ng trong t\u1EA5t c\u1EA3 t\u1ED5 ch\u1EE9c m\xE0 b\u1EA1n l\xE0 ch\u1EE7 ho\u1EB7c super admin.",
      invite: "M\u1EDDi ng\u01B0\u1EDDi d\xF9ng",
      invite_title: "M\u1EDDi ng\u01B0\u1EDDi d\xF9ng v\xE0o m\u1ED9t ho\u1EB7c nhi\u1EC1u t\u1ED5 ch\u1EE9c",
      choose_orgs: "Ch\u1ECDn t\u1ED5 ch\u1EE9c v\xE0 vai tr\xF2",
      invite_hint: "N\u1EBFu email \u0111\xE3 c\xF3 tr\xEAn JoaBooks, s\u1EBD \u0111\u01B0\u1EE3c th\xEAm tr\u1EF1c ti\u1EBFp. Ng\u01B0\u1EDDi d\xF9ng m\u1EDBi nh\u1EADn m\u1ED9t email m\u1EDDi duy nh\u1EA5t li\u1EC7t k\xEA t\u1EA5t c\u1EA3 t\u1ED5 ch\u1EE9c \u0111\xE3 ch\u1ECDn.",
      send_invite: "G\u1EEDi l\u1EDDi m\u1EDDi",
      invited: "\u0110\xE3 m\u1EDDi v\xE0o {{count}} t\u1ED5 ch\u1EE9c",
      added_existing: "\u0110\xE3 th\xEAm ng\u01B0\u1EDDi d\xF9ng hi\u1EC7n c\xF3 v\xE0o {{count}} t\u1ED5 ch\u1EE9c",
      no_manageable_tenants: "B\u1EA1n ch\u01B0a l\xE0m ch\u1EE7 hay super admin t\u1ED5 ch\u1EE9c n\xE0o."
    }
  },
  bell: {
    title: "Th\xF4ng b\xE1o",
    mark_all_read: "\u0110\xE1nh d\u1EA5u t\u1EA5t c\u1EA3 \u0111\xE3 \u0111\u1ECDc",
    no_notifications: "Kh\xF4ng c\xF3 th\xF4ng b\xE1o.",
    aria: "Th\xF4ng b\xE1o"
  },
  common: {
    submit: "G\u1EEDi",
    save: "L\u01B0u",
    cancel: "H\u1EE7y",
    approve: "Ph\xEA duy\u1EC7t",
    reject: "T\u1EEB ch\u1ED1i",
    pending: "\u0110ang ch\u1EDD",
    loading: "\u0110ang t\u1EA3i\u2026",
    actions: "Thao t\xE1c",
    status: "Tr\u1EA1ng th\xE1i",
    amount: "S\u1ED1 ti\u1EC1n",
    date: "Ng\xE0y",
    note: "Ghi ch\xFA",
    back: "Quay l\u1EA1i",
    no_active_workspace: "Kh\xF4ng c\xF3 kh\xF4ng gian l\xE0m vi\u1EC7c n\xE0o \u0111ang ho\u1EA1t \u0111\u1ED9ng.",
    logout: "\u0110\u0103ng xu\u1EA5t",
    signin: "\u0110\u0103ng nh\u1EADp",
    signup: "\u0110\u0103ng k\xFD",
    email: "Email",
    password: "M\u1EADt kh\u1EA9u",
    language: "Ng\xF4n ng\u1EEF",
    english: "English",
    chinese: "\u4E2D\u6587",
    korean: "\uD55C\uAD6D\uC5B4",
    spanish: "Espa\xF1ol",
    vietnamese: "Ti\u1EBFng Vi\u1EC7t",
    search: "T\xECm ki\u1EBFm",
    all: "T\u1EA5t c\u1EA3",
    yes: "C\xF3",
    no: "Kh\xF4ng",
    new: "M\u1EDBi",
    edit: "S\u1EEDa"
  },
  set: {
    workspace: "Kh\xF4ng gian l\xE0m vi\u1EC7c",
    workspace_name: "T\xEAn kh\xF4ng gian",
    doc_numbering: "\u0110\xE1nh s\u1ED1 ch\u1EE9ng t\u1EEB",
    doc_numbering_help: "D\xF9ng {{yyyy}} cho n\u0103m v\xE0 {{seq}} cho d\xE3y s\u1ED1 c\xF3 \u0111\u1EC7m 0.",
    workflow: "Quy tr\xECnh",
    mtx_requires_approval: "Giao d\u1ECBch th\u1EE7 c\xF4ng c\u1EA7n ph\xEA duy\u1EC7t",
    save_changes: "L\u01B0u thay \u0111\u1ED5i",
    saving: "\u0110ang l\u01B0u\u2026",
    settings_saved: "\u0110\xE3 l\u01B0u c\xE0i \u0111\u1EB7t",
    members_roles: "Th\xE0nh vi\xEAn & vai tr\xF2",
    invite_user: "M\u1EDDi ng\u01B0\u1EDDi d\xF9ng",
    invite_a_user: "M\u1EDDi ng\u01B0\u1EDDi d\xF9ng",
    display_name_optional: "T\xEAn hi\u1EC3n th\u1ECB",
    portal: "C\u1ED5ng",
    internal_staff: "Nh\xE2n vi\xEAn n\u1ED9i b\u1ED9",
    approver: "Ng\u01B0\u1EDDi duy\u1EC7t",
    primary_role: "Vai tr\xF2 ch\xEDnh",
    send_invite: "G\u1EEDi l\u1EDDi m\u1EDDi",
    sending: "\u0110ang g\u1EEDi\u2026",
    invitation_sent: "\u0110\xE3 g\u1EEDi l\u1EDDi m\u1EDDi",
    added_existing_user: "\u0110\xE3 th\xEAm {{email}} v\xE0o kh\xF4ng gian l\xE0m vi\u1EC7c n\xE0y",
    already_member: "{{email}} \u0111\xE3 l\xE0 th\xE0nh vi\xEAn c\u1EE7a kh\xF4ng gian l\xE0m vi\u1EC7c n\xE0y",
    invite_hint_existing: "N\u1EBFu ng\u01B0\u1EDDi d\xF9ng \u0111\xE3 c\xF3 t\xE0i kho\u1EA3n, h\u1ECD s\u1EBD \u0111\u01B0\u1EE3c th\xEAm tr\u1EF1c ti\u1EBFp m\xE0 kh\xF4ng c\u1EA7n email.",
    user: "Ng\u01B0\u1EDDi d\xF9ng",
    roles_label: "Vai tr\xF2",
    no_members: "Ch\u01B0a c\xF3 th\xE0nh vi\xEAn.",
    suspend: "T\u1EA1m ng\u01B0ng",
    activate: "K\xEDch ho\u1EA1t",
    roles_updated: "\u0110\xE3 c\u1EADp nh\u1EADt vai tr\xF2",
    remove_user: "X\xF3a kh\u1ECFi kh\xF4ng gian l\xE0m vi\u1EC7c",
    remove_user_confirm: "X\xF3a {{name}} kh\u1ECFi kh\xF4ng gian l\xE0m vi\u1EC7c n\xE0y? C\xE1c b\u1EA3n ghi c\u0169 (nh\u1EADt k\xFD ki\u1EC3m to\xE1n, ph\xEA duy\u1EC7t) v\u1EABn \u0111\u01B0\u1EE3c gi\u1EEF l\u1EA1i, nh\u01B0ng h\u1ECD s\u1EBD m\u1EA5t quy\u1EC1n truy c\u1EADp ngay l\u1EADp t\u1EE9c.",
    user_removed: "\u0110\xE3 x\xF3a ng\u01B0\u1EDDi d\xF9ng kh\u1ECFi kh\xF4ng gian l\xE0m vi\u1EC7c",
    cannot_remove_self: "B\u1EA1n kh\xF4ng th\u1EC3 t\u1EF1 x\xF3a m\xECnh. H\xE3y d\xF9ng 'R\u1EDDi t\u1ED5 ch\u1EE9c' thay v\xE0o \u0111\xF3.",
    cannot_remove_owner: "Kh\xF4ng th\u1EC3 x\xF3a ch\u1EE7 s\u1EDF h\u1EEFu. H\xE3y chuy\u1EC3n quy\u1EC1n s\u1EDF h\u1EEFu tr\u01B0\u1EDBc.",
    notifications_help: "C\u1EA5u h\xECnh ng\u01B0\u1EDDi nh\u1EADn th\xF4ng b\xE1o cho m\u1ED7i s\u1EF1 ki\u1EC7n v\xE0 chu\u1ED7i ph\xEA duy\u1EC7t m\u1EB7c \u0111\u1ECBnh.",
    on_submit: "Khi g\u1EEDi",
    fully_approved: "\u0110\xE3 duy\u1EC7t to\xE0n b\u1ED9",
    paid_event: "\u0110\xE3 thanh to\xE1n",
    default_approver_chain: "Chu\u1ED7i ph\xEA duy\u1EC7t m\u1EB7c \u0111\u1ECBnh",
    no_internal_members: "Kh\xF4ng c\xF3 th\xE0nh vi\xEAn n\u1ED9i b\u1ED9.",
    no_approvers_configured: "Ch\u01B0a c\u1EA5u h\xECnh ng\u01B0\u1EDDi duy\u1EC7t.",
    add_approver: "+ Th\xEAm ng\u01B0\u1EDDi duy\u1EC7t\u2026",
    remove: "G\u1EE1",
    notif_saved: "\u0110\xE3 l\u01B0u quy t\u1EAFc th\xF4ng b\xE1o",
    vendors: "Nh\xE0 cung c\u1EA5p",
    add_vendor: "Th\xEAm NCC",
    new_vendor: "NCC m\u1EDBi",
    legal_name_en: "T\xEAn ph\xE1p l\xFD (EN)",
    nick_name: "Bi\u1EC7t danh",
    contact_name: "T\xEAn li\xEAn h\u1EC7",
    contact_phone: "S\u0110T li\xEAn h\u1EC7",
    contact_email: "Email li\xEAn h\u1EC7",
    invite_to_portal_label: "M\u1EDDi NCC n\xE0y v\xE0o c\u1ED5ng nh\xE0 cung c\u1EA5p",
    vendor: "Nh\xE0 cung c\u1EA5p",
    contact: "Li\xEAn h\u1EC7",
    portal_access: "Truy c\u1EADp c\u1ED5ng",
    no_vendors: "Ch\u01B0a c\xF3 NCC.",
    linked: "\u0110\xE3 li\xEAn k\u1EBFt",
    not_linked: "Ch\u01B0a li\xEAn k\u1EBFt",
    invite_to_portal: "M\u1EDDi v\xE0o c\u1ED5ng",
    vendor_saved: "\u0110\xE3 l\u01B0u NCC",
    vendor_invited: "\u0110\xE3 m\u1EDDi NCC",
    categories: "Danh m\u1EE5c giao d\u1ECBch",
    new_category: "Danh m\u1EE5c m\u1EDBi",
    edit_category: "S\u1EEDa danh m\u1EE5c",
    name: "T\xEAn",
    type: "Lo\u1EA1i",
    sort_order: "Th\u1EE9 t\u1EF1",
    active: "Ho\u1EA1t \u0111\u1ED9ng",
    inactive: "ng\u1EEBng",
    edit: "S\u1EEDa",
    category_saved: "\u0110\xE3 l\u01B0u danh m\u1EE5c",
    pm_title: "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n",
    new_method: "Ph\u01B0\u01A1ng th\u1EE9c m\u1EDBi",
    edit_method: "S\u1EEDa ph\u01B0\u01A1ng th\u1EE9c",
    new_pm: "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n m\u1EDBi",
    code: "M\xE3",
    label: "Nh\xE3n",
    code_hint: "Ch\u1EC9 ch\u1EEF th\u01B0\u1EDDng, s\u1ED1 v\xE0 d\u1EA5u g\u1EA1ch d\u01B0\u1EDBi.",
    pa_title: "T\xE0i kho\u1EA3n thanh to\xE1n",
    pa_help: "T\xE0i kho\u1EA3n ng\xE2n h\xE0ng, ti\u1EC1n m\u1EB7t v\xE0 th\u1EBB t\xEDn d\u1EE5ng n\u1ED9i b\u1ED9 d\xF9ng \u0111\u1EC3 thu/chi.",
    add_account: "Th\xEAm t\xE0i kho\u1EA3n",
    edit_account: "S\u1EEDa t\xE0i kho\u1EA3n",
    add_payment_account: "Th\xEAm t\xE0i kho\u1EA3n thanh to\xE1n",
    account_name: "T\xEAn t\xE0i kho\u1EA3n",
    bank_name: "T\xEAn ng\xE2n h\xE0ng",
    last4: "4 s\u1ED1 cu\u1ED1i",
    opening_balance: "S\u1ED1 d\u01B0 \u0111\u1EA7u (USD)",
    description: "M\xF4 t\u1EA3",
    current_balance: "S\u1ED1 d\u01B0 hi\u1EC7n t\u1EA1i",
    no_accounts: "Ch\u01B0a c\xF3 t\xE0i kho\u1EA3n.",
    deactivate: "V\xF4 hi\u1EC7u ho\xE1",
    account_added: "\u0110\xE3 th\xEAm t\xE0i kho\u1EA3n",
    account_updated: "\u0110\xE3 c\u1EADp nh\u1EADt t\xE0i kho\u1EA3n",
    subscription: "\u0110\u0103ng k\xFD"
  }
};

// src/i18n-helper.ts
var SHARED = {
  en: en_default,
  ko: ko_default,
  zh: zh_default,
  es: es_default,
  vi: vi_default
};
function mergeSharedResources(appResources) {
  const out = {};
  for (const lang of Object.keys(SHARED)) {
    const shared = SHARED[lang] ?? {};
    const app = appResources[lang] ?? {};
    out[lang] = { translation: deepMerge(shared, app) };
  }
  return out;
}
function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    const av = a[k];
    const bv = b[k];
    if (isObj(av) && isObj(bv)) {
      out[k] = deepMerge(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}
function isObj(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ko", label: "\uD55C\uAD6D\uC5B4" },
  { code: "zh", label: "\u4E2D\u6587" },
  { code: "es", label: "Espa\xF1ol" },
  { code: "vi", label: "Ti\u1EBFng Vi\u1EC7t" }
];
function ThemeToggle() {
  const { ui, themeStorageKey = "joasuite-theme" } = useJoaSuite();
  const { Button } = ui;
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const saved = localStorage.getItem(themeStorageKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved ? saved === "dark" : prefersDark;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    setIsDark(dark);
  }, [themeStorageKey]);
  const toggle = () => {
    const root = document.documentElement;
    const next = !isDark;
    if (next) {
      root.classList.add("dark");
      localStorage.setItem(themeStorageKey, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(themeStorageKey, "light");
    }
    setIsDark(next);
  };
  return /* @__PURE__ */ jsx(
    Button,
    {
      variant: "ghost",
      size: "icon",
      onClick: toggle,
      "aria-label": "Toggle theme",
      className: "shrink-0",
      children: isDark ? /* @__PURE__ */ jsx(Moon, { className: "h-5 w-5" }) : /* @__PURE__ */ jsx(Sun, { className: "h-5 w-5" })
    }
  );
}
function LanguageSwitcher({ className, variant = "default" }) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const cls = [
    "flex items-center gap-1.5 text-xs",
    className ?? ""
  ].join(" ");
  const selectCls = [
    "rounded px-1.5 py-1 border outline-none cursor-pointer",
    variant === "sidebar" ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border" : "bg-background text-foreground border-input"
  ].join(" ");
  return /* @__PURE__ */ jsxs("label", { className: cls, children: [
    /* @__PURE__ */ jsx(Globe, { className: "h-3.5 w-3.5 opacity-70" }),
    /* @__PURE__ */ jsx(
      "select",
      {
        "aria-label": "Language",
        value: current,
        onChange: (e) => i18n.changeLanguage(e.target.value),
        className: selectCls,
        children: SUPPORTED_LANGUAGES.map((l) => /* @__PURE__ */ jsx("option", { value: l.code, children: l.label }, l.code))
      }
    )
  ] });
}

// src/components/UserBadge.tsx
function UserBadge(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: UserBadge is not yet ported. See README.md."
  );
}

// src/components/NotificationsBell.tsx
function NotificationsBell(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: NotificationsBell is not yet ported. See README.md."
  );
}

// src/components/SuiteSwitcher.tsx
function SuiteSwitcher(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: SuiteSwitcher is not yet ported. See README.md."
  );
}

// src/components/SuiteHomePage.tsx
function SuiteHomePage(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: SuiteHomePage is not yet ported. See README.md."
  );
}

// src/components/SuiteSettingsHub.tsx
function SuiteSettingsHub(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: SuiteSettingsHub is not yet ported. See README.md."
  );
}

// src/components/people/PeopleListPage.tsx
function PeopleListPage(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: PeopleListPage is not yet ported. See README.md."
  );
}

// src/components/people/PeopleInvitePage.tsx
function PeopleInvitePage(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: PeopleInvitePage is not yet ported. See README.md."
  );
}

// src/components/people/PeopleDetailPage.tsx
function PeopleDetailPage(_props = {}) {
  throw new Error(
    "@joasuite/shared-ui: PeopleDetailPage is not yet ported. See README.md."
  );
}

export { APP_CODES, APP_DISPLAY, DEFAULT_APP_URLS, JoaSuiteProvider, LanguageSwitcher, NotificationsBell, PeopleDetailPage, PeopleInvitePage, PeopleListPage, ROLES_BY_APP, SETTINGS_KV_APP_URL_KEYS, SUPPORTED_LANGUAGES, SuiteHomePage, SuiteSettingsHub, SuiteSwitcher, ThemeToggle, UserBadge, mergeSharedResources, useJoaSuite };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map