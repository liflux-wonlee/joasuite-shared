/**
 * Dependency-injection context for @joasuite/shared-ui.
 *
 * The shared components need access to app-specific things that this
 * package CANNOT import directly:
 *   - the host app's Supabase client (different env per app)
 *   - the host app's `useAuth` hook (each app wires Supabase auth its own way)
 *   - the host app's shadcn UI primitives (Button, Dialog, …)
 *   - the host app's TanStack Router `Link` and navigation helpers
 *
 * Each consuming app wraps its tree in <JoaSuiteProvider> once and passes
 * these in. The shared components read them via useJoaSuite().
 */
import { createContext, useContext, type ReactNode, type ComponentType } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppCode } from "./constants";
import type { Membership, AppSummaryTile } from "./types";

export type AuthState = {
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null;
  currentTenantId: string | null;
  currentMembership: Membership | null;
  memberships: Membership[];
  setCurrentTenantId: (id: string) => void;
  refresh: () => Promise<void>;
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
export type UiAdapter = {
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
  DialogDescription: ComponentType<any>;
  DialogFooter: ComponentType<any>;
  DialogHeader: ComponentType<any>;
  DialogTitle: ComponentType<any>;
  DialogTrigger: ComponentType<any>;
  Tabs: ComponentType<any>;
  TabsList: ComponentType<any>;
  TabsTrigger: ComponentType<any>;
  TabsContent: ComponentType<any>;
  Textarea: ComponentType<any>;
  EmailInput: ComponentType<any>;
};

/**
 * Router adapter — TanStack Router's `<Link>` is type-aware of the host
 * app's routes, so the host must supply it (and useNavigate) rather than
 * letting the package import @tanstack/react-router types directly.
 */
export type RouterAdapter = {
  Link: ComponentType<any>;
  useNavigate: () => (opts: { to: string; params?: Record<string, string> }) => void;
  /** Current location pathname, for active-tab/nav highlighting in layout-style components. */
  usePathname: () => string;
};

/**
 * Bound server function. The host app exports a `useServerFn`-wrapped
 * version of each shared server function (see ./server) and passes them
 * in. The shared components just call them like ordinary async fns.
 */
export type BoundServerFns = {
  listSuiteApps: (input: { tenantId: string }) => Promise<{
    catalog: any[];
    subscriptions: any[];
    myAppCodes: string[];
  }>;
  subscribeApp: (input: { tenantId: string; appCode: string; plan: string }) => Promise<{ ok: true }>;
  cancelApp: (input: { tenantId: string; appCode: string }) => Promise<{ ok: true }>;
  createTenant: (input: { name: string; display_name?: string }) => Promise<{ tenant: { id: string; [k: string]: any } }>;
  getSuiteHome: (input: { tenantId: string }) => Promise<any>;
  setAppUrl: (input: { tenantId: string; appCode: AppCode; url: string }) => Promise<{ ok: true }>;
  getAppSummaries: (input: { tenantIds: string[] }) => Promise<AppSummaryTile[]>;
  listNotifications: (input: { tenant_id: string; limit?: number }) => Promise<{
    unread_count: number;
    rows: any[];
  }>;
  markNotificationRead: (input: { id: string }) => Promise<{ ok: true }>;
  markAllNotificationsRead: (input: { tenant_id: string }) => Promise<{ ok: true }>;
  listManageableUsers: () => Promise<{
    tenants: any[];
    users: any[];
    caller_owner_tenant_ids: string[];
  }>;
  inviteUserToWorkspaces: (input: any) => Promise<any>;
  setUserAppRoles: (input: any) => Promise<any>;
  removeTenantUser: (input: any) => Promise<any>;
  accountResendInvitation: (input: { user_id: string }) => Promise<any>;
  accountSendPasswordReset: (input: { user_id: string }) => Promise<any>;
  accountUpdateUserProfile: (input: any) => Promise<any>;
  listTeamMembers: (input: {
    tenant_id: string;
    search?: string;
    worker_type?: "employee" | "contractor";
  }) => Promise<{ rows: any[] }>;
  getTeamMember: (input: { tenant_id: string; party_id: string }) => Promise<any>;
  upsertTeamMember: (input: any) => Promise<{ party_id: string; created: boolean }>;
  listDepartmentsAndPositions: (input: {
    tenant_id: string;
  }) => Promise<{ departments: any[]; positions: any[] }>;
  createDepartment: (input: { tenant_id: string; name: string; code?: string | null }) => Promise<any>;
  updateDepartment: (input: {
    tenant_id: string;
    id: string;
    name: string;
    code?: string | null;
  }) => Promise<any>;
  deleteDepartment: (input: { tenant_id: string; id: string }) => Promise<any>;
  createPosition: (input: {
    tenant_id: string;
    department_id: string;
    name: string;
  }) => Promise<any>;
  updatePosition: (input: { tenant_id: string; id: string; name: string }) => Promise<any>;
  deletePosition: (input: { tenant_id: string; id: string }) => Promise<any>;

  // ── Billing (organization-scoped; identical across every JoaSuite app) ──
  canManageBillingFn: (input: { tenant_id: string }) => Promise<{
    can_manage: boolean;
    can_view: boolean;
    roles: string[];
  }>;
  getBillingOverview: (input: { tenant_id: string }) => Promise<any>;
  updateBillingCustomer: (input: any) => Promise<any>;
  listBillingPlans: (input?: { app_code?: string; interval?: "month" | "year" }) => Promise<any[]>;
  changeSubscriptionPlan: (input: {
    tenant_id: string;
    app_code: string;
    plan_code: string;
    interval?: "month" | "year";
    seats?: number;
  }) => Promise<any>;
  cancelSubscription: (input: {
    tenant_id: string;
    app_code: string;
    at_period_end?: boolean;
  }) => Promise<any>;
  listBillingInvoices: (input: { tenant_id: string; limit?: number }) => Promise<any[]>;
  getBillingInvoice: (input: { tenant_id: string; id: string }) => Promise<any>;
  retryInvoicePayment: (input: { tenant_id: string; id: string }) => Promise<any>;
  seedSampleBillingInvoices: (input: { tenant_id: string }) => Promise<any>;
  listBillingPaymentMethods: (input: { tenant_id: string }) => Promise<any[]>;
  addMockPaymentMethod: (input: {
    tenant_id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    make_default?: boolean;
  }) => Promise<any>;
  setDefaultPaymentMethod: (input: { tenant_id: string; id: string }) => Promise<any>;
  removePaymentMethod: (input: { tenant_id: string; id: string }) => Promise<any>;
  startTrial: (input: {
    tenant_id: string;
    app_code: string;
    plan_code?: string;
    interval?: "month" | "year";
    trial_days?: number;
  }) => Promise<any>;
  reactivateSubscription: (input: { tenant_id: string; app_code: string }) => Promise<any>;
  addAppSubscription: (input: {
    tenant_id: string;
    app_code: string;
    plan_code?: string;
    interval?: "month" | "year";
  }) => Promise<any>;
  removeAppSubscription: (input: { tenant_id: string; app_code: string }) => Promise<any>;
  listAvailablePromotions: (input: { tenant_id: string }) => Promise<any[]>;
  listTenantDiscounts: (input: { tenant_id: string }) => Promise<any[]>;
  redeemPromoCode: (input: { tenant_id: string; code: string }) => Promise<any>;
  removeTenantDiscount: (input: { tenant_id: string; discount_id: string }) => Promise<any>;
  getReferralProgram: (input: { tenant_id: string }) => Promise<any>;
  addMockReferral: (input: {
    tenant_id: string;
    referee_email: string;
    referee_org_name?: string;
    status?: "pending" | "signed_up" | "subscribed";
  }) => Promise<any>;
  updateReferralStatus: (input: {
    tenant_id: string;
    referral_id: string;
    status: "pending" | "signed_up" | "subscribed" | "canceled";
  }) => Promise<any>;
  getTenantUsage: (input: { tenant_id: string; app_code?: string }) => Promise<any>;
  listActiveBundleRules: () => Promise<any[]>;
};

export type JoaSuiteContextValue = {
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

const JoaSuiteContext = createContext<JoaSuiteContextValue | null>(null);

export function JoaSuiteProvider({
  value,
  children,
}: {
  value: JoaSuiteContextValue;
  children: ReactNode;
}) {
  return <JoaSuiteContext.Provider value={value}>{children}</JoaSuiteContext.Provider>;
}

export function useJoaSuite(): JoaSuiteContextValue {
  const v = useContext(JoaSuiteContext);
  if (!v) {
    throw new Error(
      "@joasuite/shared-ui: useJoaSuite called outside <JoaSuiteProvider>. " +
        "Wrap your app root with JoaSuiteProvider and pass the required adapters.",
    );
  }
  return v;
}
