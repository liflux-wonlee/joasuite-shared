import type { AppCode } from "./constants";

export type { AppCode };

export type Membership = {
  tenant_id: string;
  tenant_name: string | null;
  roles: string[];
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
