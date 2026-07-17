import type { AppCode } from "./constants";

export type { AppCode };

export type Membership = {
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
export type UserAppAssignment = {
  tenant_id: string;
  portal: string;
  status: string;
  joined_at: string | null;
  position: string | null;
  apps: Record<string, { roles: string[] }>;
};

export type ManageableUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  position: string | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
  assignments: Record<string, UserAppAssignment>;
};

export type ManageableTenant = {
  id: string;
  name: string;
  slug: string;
  app_codes: string[];
  app_plans?: Record<string, string | null>;
};

export type InvitePresetKey =
  | "owner_admin"
  | "manager"
  | "finance_staff"
  | "field_tech"
  | "approver"
  | "custom";

/**
 * Team (Employee/Contractor) types (shared across every JoaSuite app
 * except the future JoaHR app, which owns the full HR surface). These map
 * to the shared core tables `departments`/`positions`/`parties`/
 * `employee_profiles` — never to HR-confidential extension tables, which
 * remain app-owned (e.g. JoaOffice's `office.employee_hr_records`).
 */
export type Department = {
  id: string;
  name: string;
  code: string | null;
};

export type Position = {
  id: string;
  name: string;
  department_id: string;
};

export type TeamMemberRow = {
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

export type TeamMemberInput = {
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

export type AppCatalogEntry = {
  code: AppCode | string;
  name: string;
  description: string | null;
  plans: Array<{ code: string; name: string }>;
  sort_order: number;
};

export type TenantAppRow = {
  app_code: AppCode | string;
  plan: string;
  status: "active" | "canceled" | string;
  activated_at: string;
  canceled_at: string | null;
  deletion_scheduled_at: string | null;
};

export type ApprovalSummary = {
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

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
  app_code: string | null;
};

export type SuiteHomeData = {
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
export type AppSummaryTile = {
  app_code: AppCode;
  headline_label: string;
  headline_value: string;
  trend?: "up" | "down" | "flat";
  secondary: Array<{ label: string; value: string }>;
  alert_count?: number;
  link_path: string;
};
