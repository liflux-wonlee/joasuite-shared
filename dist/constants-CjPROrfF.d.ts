/**
 * Canonical JoaSuite app codes. Never invent variants — these are the
 * exact values used in `app_catalog`, `tenant_apps`, `user_roles.app_code`,
 * `settings_kv` (`app_url.<code>`), `approvals.source_app`, etc.
 */
declare const APP_CODES: readonly ["joabooks", "joaapproval", "joacrm", "joaoffice", "joasop"];
type AppCode = (typeof APP_CODES)[number];
/**
 * Display metadata for each app. User-facing names — DB identifiers are
 * the lowercase codes above.
 */
declare const APP_DISPLAY: Array<{
    code: AppCode;
    name: string;
    description: string;
}>;
/**
 * Default external URL per app. Each tenant can override via
 * `settings_kv` row keyed `app_url.<code>`.
 */
declare const DEFAULT_APP_URLS: Record<AppCode, string>;
/**
 * Roles available per app. Used by People > Invite and the role editor.
 * Suite-wide roles (`owner`, `super_admin`) satisfy any app's role check
 * when stored with `user_roles.app_code IS NULL`.
 */
declare const ROLES_BY_APP: Record<AppCode, string[]>;
declare const SETTINGS_KV_APP_URL_KEYS: ("app_url.joabooks" | "app_url.joaapproval" | "app_url.joacrm" | "app_url.joaoffice" | "app_url.joasop")[];

export { type AppCode as A, DEFAULT_APP_URLS as D, ROLES_BY_APP as R, SETTINGS_KV_APP_URL_KEYS as S, APP_CODES as a, APP_DISPLAY as b };
