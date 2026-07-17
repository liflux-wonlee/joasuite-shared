/**
 * Canonical JoaSuite app codes. Never invent variants — these are the
 * exact values used in `app_catalog`, `tenant_apps`, `user_roles.app_code`,
 * `settings_kv` (`app_url.<code>`), `approvals.source_app`, etc.
 */
export const APP_CODES = ["joabooks", "joaapproval", "joacrm", "joaoffice", "joasop", "joahr"] as const;
export type AppCode = (typeof APP_CODES)[number];

/**
 * Display metadata for each app. User-facing names — DB identifiers are
 * the lowercase codes above.
 */
export const APP_DISPLAY: Array<{
  code: AppCode;
  name: string;
  description: string;
}> = [
  { code: "joabooks", name: "JoaBooks", description: "Finance — AP, AR, expenses, ledger" },
  { code: "joaapproval", name: "JoaApproval", description: "Cross-app approval inbox" },
  { code: "joacrm", name: "JoaCRM", description: "Customer relationships" },
  { code: "joaoffice", name: "JoaOffice", description: "Admin, assets, contracts" },
  { code: "joasop", name: "JoaSOP", description: "Policies, SOPs, training" },
  { code: "joahr", name: "JoaHR", description: "HR — people, time off, org chart" },
];

/**
 * Default external URL per app. Each tenant can override via
 * `settings_kv` row keyed `app_url.<code>`.
 */
export const DEFAULT_APP_URLS: Record<AppCode, string> = {
  joabooks: "https://books.joasuite.com",
  joaapproval: "https://approval.joasuite.com",
  joacrm: "https://crm.joasuite.com",
  joaoffice: "https://office.joasuite.com",
  joasop: "https://sop.joasuite.com",
  joahr: "https://hr.joasuite.com",
};

/**
 * Roles available per app. Used by Users > Invite and the role editor.
 * Suite-wide roles (`owner`, `super_admin`) satisfy any app's role check
 * when stored with `user_roles.app_code IS NULL`.
 */
export const ROLES_BY_APP: Record<AppCode, string[]> = {
  joabooks: [
    "owner",
    "super_admin",
    "admin",
    "finance_manager",
    "finance_ap",
    "finance_ar",
    "accountant",
    "approver",
  ],
  joasop: ["owner", "super_admin", "sop_admin", "sop_author", "sop_reviewer", "sop_operator"],
  joaoffice: ["owner", "super_admin", "approver"],
  joaapproval: ["owner", "super_admin", "approver"],
  joacrm: ["owner", "super_admin", "approver"],
  joahr: ["owner", "super_admin", "approver"],
};

export const SETTINGS_KV_APP_URL_KEYS = APP_CODES.map((c) => `app_url.${c}` as const);

/**
 * Display-only: the stored/submitted role value keeps its "sop_" prefix
 * (it's a real DB enum value used by JoaSOP's own authorization checks);
 * this just makes the label shown to admins less redundant, since the
 * row is already badged with the app code.
 */
export function roleLabel(role: string): string {
  return role.startsWith("sop_") ? role.slice(4) : role;
}
