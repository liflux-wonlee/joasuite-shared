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

import { APP_CODES, type AppCode } from "../constants";

// ──────────────────────────────────────────────────────────────────────────────
// JoaSuite Core — Billing module
// Organization-scoped. No real Stripe calls; mutations are simulated.
// Reusable across all JoaSuite apps (joabooks / joasop / joaoffice / joaapproval / joacrm / joahr).
// ──────────────────────────────────────────────────────────────────────────────

export { APP_CODES, type AppCode };
export const PLAN_CODES = ["free", "basic", "pro", "business"] as const;
export const INTERVALS = ["month", "year"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export type BillingInterval = (typeof INTERVALS)[number];
const SOURCE_APP = "joasuite-core";

export type BillingContext = { supabase: any; userId: string };
export type BillingDeps = { supabaseAdmin: any; appCode: string };

type Role = { role: string; app_code: string | null };

async function getRoles(supabase: any, tenantId: string, userId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, app_code")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Role[];
}

// owner/super_admin are suite-wide by convention (app_code IS NULL); every
// other billing role (billing_admin, finance_manager) is app-scoped like any
// other non-owner role (see ROLES_BY_APP), so it only counts for the app the
// caller is currently in (deps.appCode) — otherwise a billing_admin/
// finance_manager grant in one app could view or manage every other
// subscribed app's billing for the same tenant.
function canManage(roles: Role[], appCode: string) {
  return roles.some((r) => {
    if (r.role === "owner" || r.role === "super_admin") return true;
    if (r.role === "billing_admin") return r.app_code === null || r.app_code === appCode;
    return false;
  });
}
function canView(roles: Role[], appCode: string) {
  if (canManage(roles, appCode)) return true;
  return roles.some((r) => r.role === "finance_manager" && (r.app_code === null || r.app_code === appCode));
}

async function assertView(supabase: any, tenantId: string, userId: string, appCode: string) {
  const roles = await getRoles(supabase, tenantId, userId);
  if (!canView(roles, appCode)) throw new Error("Forbidden: billing access not allowed for this role");
  return roles.map((r) => r.role);
}
async function assertManage(supabase: any, tenantId: string, userId: string, appCode: string) {
  const roles = await getRoles(supabase, tenantId, userId);
  if (!canManage(roles, appCode)) throw new Error("Forbidden: billing management requires Owner, Super Admin, or Billing Admin");
  return roles.map((r) => r.role);
}

async function writeAudit(
  deps: BillingDeps,
  opts: {
    tenant_id: string;
    user_id: string;
    action: string;
    record_id?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  try {
    await deps.supabaseAdmin.from("audit_logs").insert({
      tenant_id: opts.tenant_id,
      user_id: opts.user_id,
      record_type: "billing",
      record_id: opts.record_id ?? null,
      action: opts.action,
      source_app: SOURCE_APP,
      new_value: opts.payload ?? null,
    } as never);
  } catch {
    // best-effort; never block billing actions on audit failure
  }
}

export type TenantInput = { tenant_id: string };

// ──────────────────────────────────────────────────────────────────────────────
// Permission helpers (client gating)
// ──────────────────────────────────────────────────────────────────────────────
export async function canManageBillingFnServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  const roles = await getRoles(context.supabase, input.tenant_id, context.userId);
  return {
    can_manage: canManage(roles, deps.appCode),
    can_view: canView(roles, deps.appCode),
    roles: roles.map((r) => r.role),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Overview
// ──────────────────────────────────────────────────────────────────────────────
export async function getBillingOverviewServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  const rawRoles = await getRoles(context.supabase, input.tenant_id, userId);
  if (!canView(rawRoles, deps.appCode)) throw new Error("Forbidden: billing access not allowed for this role");
  const roles = rawRoles.map((r) => r.role);

  const [customerQ, subsQ, pmQ, tenantAppsQ, tenantQ] = await Promise.all([
    context.supabase.from("billing_customers").select("*").eq("tenant_id", input.tenant_id).maybeSingle(),
    context.supabase.from("billing_subscriptions").select("*").eq("tenant_id", input.tenant_id),
    context.supabase.from("billing_payment_methods").select("*").eq("tenant_id", input.tenant_id).order("is_default", { ascending: false }),
    context.supabase.from("tenant_apps").select("app_code, plan, status").eq("tenant_id", input.tenant_id).eq("status", "active"),
    context.supabase.from("tenants").select("id, name").eq("id", input.tenant_id).single(),
  ]);

  if (tenantQ.error) throw new Error(tenantQ.error.message);

  const subs = subsQ.data ?? [];
  const tenantApps = tenantAppsQ.data ?? [];
  // Synthesize "free" entries for subscribed apps that don't have a billing row yet
  const merged = tenantApps.map((ta: any) => {
    const sub = subs.find((s: any) => s.app_code === ta.app_code);
    if (sub) return sub;
    return {
      id: null,
      tenant_id: input.tenant_id,
      app_code: ta.app_code,
      plan_code: ta.plan ?? "free",
      interval: "month",
      seats: 1,
      status: ta.status ?? "active",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      trial_end: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      synthetic: true,
    };
  });

  const defaultPm = (pmQ.data ?? [])[0] ?? null;

  // Mock next invoice estimate from current paid plans
  let estimateCents = 0;
  if (merged.length) {
    const planRows = await context.supabase
      .from("billing_plans")
      .select("app_code, plan_code, interval, price_cents")
      .in("app_code", merged.map((m: any) => m.app_code));
    (planRows.data ?? []).forEach((p: any) => {
      const m = merged.find((x: any) => x.app_code === p.app_code && x.plan_code === p.plan_code && x.interval === p.interval);
      if (m) estimateCents += (p.price_cents ?? 0) * (m.seats ?? 1);
    });
  }

  return {
    tenant: tenantQ.data,
    customer: customerQ.data ?? null,
    subscriptions: merged,
    default_payment_method: defaultPm,
    next_invoice_estimate_cents: estimateCents,
    roles,
    can_manage: canManage(rawRoles, deps.appCode),
    can_view: canView(rawRoles, deps.appCode),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Customer details
// ──────────────────────────────────────────────────────────────────────────────
export type UpdateBillingCustomerInput = {
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

export async function updateBillingCustomerServer(input: UpdateBillingCustomerInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const { tenant_id, ...patch } = input;
  const { data: row, error } = await context.supabase
    .from("billing_customers")
    .upsert({ tenant_id, ...patch }, { onConflict: "tenant_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id, user_id: userId, action: "billing.customer_updated", record_id: tenant_id, payload: patch });
  return row;
}

// ──────────────────────────────────────────────────────────────────────────────
// Plans (public catalog — auth optional)
// ──────────────────────────────────────────────────────────────────────────────
export type ListBillingPlansInput = { app_code?: AppCode; interval?: BillingInterval };

export async function listBillingPlansServer(input: ListBillingPlansInput, deps: BillingDeps) {
  // No auth context here — this is a public plan catalog, so it stays on
  // the admin client rather than an authenticated context.supabase (which
  // wouldn't exist for an unauthenticated caller anyway).
  let q = deps.supabaseAdmin.from("billing_plans").select("*").eq("is_active", true).order("app_code").order("sort_order");
  if (input.app_code) q = q.eq("app_code", input.app_code);
  if (input.interval) q = q.eq("interval", input.interval);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return rows ?? [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Subscriptions (mock mutations — no Stripe)
// ──────────────────────────────────────────────────────────────────────────────
export type ChangeSubscriptionPlanInput = {
  tenant_id: string;
  app_code: AppCode;
  plan_code: PlanCode;
  interval: BillingInterval;
  seats: number;
};

export async function changeSubscriptionPlanServer(input: ChangeSubscriptionPlanInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  const now = new Date();
  const end = new Date(now);
  if (input.interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);

  const { data: row, error } = await context.supabase
    .from("billing_subscriptions")
    .upsert(
      {
        tenant_id: input.tenant_id,
        app_code: input.app_code,
        plan_code: input.plan_code,
        interval: input.interval,
        seats: input.seats,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "tenant_id,app_code" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  // tenant_apps.plan is a denormalized copy of billing_subscriptions.plan_code,
  // read directly by other screens (e.g. the Users/People admin detail page's
  // per-app plan badge) that don't join billing_subscriptions. Keep it in sync
  // here the same way createStartTrial/createAddAppSubscription already do,
  // or those screens silently show a stale plan tier after every plan change.
  await context.supabase.from("tenant_apps").upsert(
    { tenant_id: input.tenant_id, app_code: input.app_code, plan: input.plan_code, status: "active" },
    { onConflict: "tenant_id,app_code" },
  );

  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.plan_changed",
    record_id: row.id,
    payload: { app_code: input.app_code, plan_code: input.plan_code, interval: input.interval, seats: input.seats, mock: true },
  });
  return { ok: true, mock: true, subscription: row };
}

export type CancelSubscriptionInput = { tenant_id: string; app_code: AppCode; at_period_end: boolean };

export async function cancelSubscriptionServer(input: CancelSubscriptionInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  const update = input.at_period_end
    ? { cancel_at_period_end: true }
    : { cancel_at_period_end: true, status: "canceled" as const };

  const { data: row, error } = await context.supabase
    .from("billing_subscriptions")
    .update(update)
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", input.app_code)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);

  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.subscription_canceled",
    record_id: row?.id ?? null,
    payload: { app_code: input.app_code, at_period_end: input.at_period_end, mock: true },
  });
  return { ok: true, mock: true, subscription: row };
}

// ──────────────────────────────────────────────────────────────────────────────
// Invoices
// ──────────────────────────────────────────────────────────────────────────────
export type ListBillingInvoicesInput = { tenant_id: string; limit: number };

export async function listBillingInvoicesServer(input: ListBillingInvoicesInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const { data: rows, error } = await context.supabase
    .from("billing_invoices")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .order("issued_at", { ascending: false })
    .limit(input.limit);
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export type GetBillingInvoiceInput = { tenant_id: string; id: string };

export async function getBillingInvoiceServer(input: GetBillingInvoiceInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const { data: row, error } = await context.supabase
    .from("billing_invoices")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.id)
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function retryInvoicePaymentServer(input: GetBillingInvoiceInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  // Stripe not connected yet — record the intent only.
  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.invoice_retry_requested",
    record_id: input.id,
    payload: { mock: true, note: "Stripe integration coming later" },
  });
  return { ok: false, mock: true, message: "Stripe integration coming later" };
}

export async function seedSampleBillingInvoicesServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  const { count } = await context.supabase
    .from("billing_invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenant_id);
  if ((count ?? 0) > 0) return { ok: true, inserted: 0, skipped: true };

  const now = new Date();
  const monthStart = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return d.toISOString();
  };
  const monthEnd = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
    return d.toISOString();
  };

  const yr = now.getFullYear();
  const rows = [
    {
      tenant_id: input.tenant_id, number: `INV-${yr}-0001`, app_code: "joabooks",
      amount_cents: 4900, amount_paid_cents: 4900, currency: "usd", status: "paid",
      issued_at: monthStart(2), due_at: monthEnd(2), paid_at: monthEnd(2),
      period_start: monthStart(2), period_end: monthEnd(2),
      description: "JoaBooks Business — monthly",
    },
    {
      tenant_id: input.tenant_id, number: `INV-${yr}-0002`, app_code: "joasop",
      amount_cents: 2900, amount_paid_cents: 2900, currency: "usd", status: "paid",
      issued_at: monthStart(1), due_at: monthEnd(1), paid_at: monthEnd(1),
      period_start: monthStart(1), period_end: monthEnd(1),
      description: "JoaSOP Pro — monthly",
    },
    {
      tenant_id: input.tenant_id, number: `INV-${yr}-0003`, app_code: "joabooks",
      amount_cents: 4900, amount_paid_cents: 0, currency: "usd", status: "open",
      issued_at: monthStart(0), due_at: monthEnd(0), paid_at: null,
      period_start: monthStart(0), period_end: monthEnd(0),
      description: "JoaBooks Business — monthly",
    },
    {
      tenant_id: input.tenant_id, number: `INV-${yr}-0004`, app_code: "joasop",
      amount_cents: 2900, amount_paid_cents: 0, currency: "usd", status: "failed",
      issued_at: monthStart(0), due_at: monthEnd(0), paid_at: null,
      period_start: monthStart(0), period_end: monthEnd(0),
      description: "JoaSOP Pro — monthly (card declined)",
    },
  ];
  const { error } = await context.supabase.from("billing_invoices").insert(rows as never);
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.invoices_seeded", payload: { count: rows.length } });
  return { ok: true, inserted: rows.length };
}

// ──────────────────────────────────────────────────────────────────────────────
// Payment methods (mock; display fields only)
// ──────────────────────────────────────────────────────────────────────────────
export async function listBillingPaymentMethodsServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const { data: rows, error } = await context.supabase
    .from("billing_payment_methods")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export type AddMockPaymentMethodInput = {
  tenant_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  make_default: boolean;
};

export async function addMockPaymentMethodServer(input: AddMockPaymentMethodInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  if (input.make_default) {
    await context.supabase
      .from("billing_payment_methods")
      .update({ is_default: false })
      .eq("tenant_id", input.tenant_id);
  }
  const { data: row, error } = await context.supabase
    .from("billing_payment_methods")
    .insert({
      tenant_id: input.tenant_id,
      brand: input.brand,
      last4: input.last4,
      exp_month: input.exp_month,
      exp_year: input.exp_year,
      is_default: input.make_default,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.payment_method_added", record_id: row.id, payload: { brand: input.brand, last4: input.last4, mock: true } });
  return row;
}

export type PaymentMethodIdInput = { tenant_id: string; id: string };

export async function setDefaultPaymentMethodServer(input: PaymentMethodIdInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  await context.supabase
    .from("billing_payment_methods")
    .update({ is_default: false })
    .eq("tenant_id", input.tenant_id);
  const { error } = await context.supabase
    .from("billing_payment_methods")
    .update({ is_default: true })
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.payment_method_default", record_id: input.id });
  return { ok: true };
}

export async function removePaymentMethodServer(input: PaymentMethodIdInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const { error } = await context.supabase
    .from("billing_payment_methods")
    .delete()
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.payment_method_removed", record_id: input.id });
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Trial / reactivate / add / remove (mock; no Stripe)
// ──────────────────────────────────────────────────────────────────────────────
export type StartTrialInput = {
  tenant_id: string;
  app_code: AppCode;
  plan_code: PlanCode;
  interval: BillingInterval;
  trial_days: number;
};

export async function startTrialServer(input: StartTrialInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const now = new Date();
  const end = new Date(now.getTime() + input.trial_days * 86_400_000);
  const { data: row, error } = await context.supabase
    .from("billing_subscriptions")
    .upsert(
      {
        tenant_id: input.tenant_id,
        app_code: input.app_code,
        plan_code: input.plan_code,
        interval: input.interval,
        seats: 1,
        status: "trialing",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        trial_end: end.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "tenant_id,app_code" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  await context.supabase.from("tenant_apps").upsert(
    {
      tenant_id: input.tenant_id,
      app_code: input.app_code,
      plan: input.plan_code,
      status: "active",
      activated_at: now.toISOString(),
      canceled_at: null,
      deletion_scheduled_at: null,
    },
    { onConflict: "tenant_id,app_code" },
  );
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.trial_started", record_id: row.id, payload: { app_code: input.app_code, trial_days: input.trial_days, mock: true } });
  return { ok: true, mock: true, subscription: row };
}

export type AppSubscriptionInput = { tenant_id: string; app_code: AppCode };

export async function reactivateSubscriptionServer(input: AppSubscriptionInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const { data: row, error } = await context.supabase
    .from("billing_subscriptions")
    .update({ status: "active", cancel_at_period_end: false })
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", input.app_code)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  await context.supabase
    .from("tenant_apps")
    .update({ status: "active", canceled_at: null, deletion_scheduled_at: null })
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", input.app_code);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.subscription_reactivated", record_id: row?.id ?? null, payload: { app_code: input.app_code, mock: true } });
  return { ok: true, mock: true, subscription: row };
}

export type AddAppSubscriptionInput = {
  tenant_id: string;
  app_code: AppCode;
  plan_code: PlanCode;
  interval: BillingInterval;
};

export async function addAppSubscriptionServer(input: AddAppSubscriptionInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const now = new Date();
  const end = new Date(now);
  if (input.interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  const { data: row, error } = await context.supabase
    .from("billing_subscriptions")
    .upsert(
      {
        tenant_id: input.tenant_id,
        app_code: input.app_code,
        plan_code: input.plan_code,
        interval: input.interval,
        seats: 1,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "tenant_id,app_code" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  await context.supabase.from("tenant_apps").upsert(
    {
      tenant_id: input.tenant_id,
      app_code: input.app_code,
      plan: input.plan_code,
      status: "active",
      activated_at: now.toISOString(),
      canceled_at: null,
      deletion_scheduled_at: null,
    },
    { onConflict: "tenant_id,app_code" },
  );
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.app_added", record_id: row.id, payload: { app_code: input.app_code, plan_code: input.plan_code, mock: true } });
  return { ok: true, mock: true, subscription: row };
}

export async function removeAppSubscriptionServer(input: AppSubscriptionInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  if (input.app_code === "joabooks") throw new Error("JoaBooks cannot be removed");
  await context.supabase
    .from("billing_subscriptions")
    .delete()
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", input.app_code);
  await context.supabase
    .from("tenant_apps")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", input.app_code);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.app_removed", payload: { app_code: input.app_code, mock: true } });
  return { ok: true, mock: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Discounts & Promotions
// ──────────────────────────────────────────────────────────────────────────────

function computePromoStatus(p: { starts_at: string | null; ends_at: string | null; active: boolean }): "upcoming" | "active" | "expired" {
  const now = Date.now();
  if (!p.active) return "expired";
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return "upcoming";
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return "expired";
  return "active";
}

export async function listAvailablePromotionsServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const { data: rows, error } = await context.supabase
    .from("promotion_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (rows ?? []).map((r: any) => ({ ...r, computed_status: computePromoStatus(r) }));
}

export async function listTenantDiscountsServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const { data: rows, error } = await context.supabase
    .from("billing_discounts")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return rows ?? [];
}

export type RedeemPromoCodeInput = { tenant_id: string; code: string };

export async function redeemPromoCodeServer(input: RedeemPromoCodeInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const code = input.code.trim().toUpperCase();

  const { data: promo, error: pErr } = await context.supabase
    .from("promotion_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!promo) return { ok: false as const, reason: "not_found" as const };

  const status = computePromoStatus(promo as any);
  if (status !== "active") return { ok: false as const, reason: status };
  if ((promo as any).max_redemptions != null && (promo as any).redemption_count >= (promo as any).max_redemptions) {
    return { ok: false as const, reason: "exhausted" as const };
  }

  const { data: existing } = await context.supabase
    .from("billing_discounts")
    .select("id")
    .eq("tenant_id", input.tenant_id)
    .eq("promotion_code_id", (promo as any).id)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return { ok: false as const, reason: "already_applied" as const };

  const { data: inserted, error: iErr } = await context.supabase
    .from("billing_discounts")
    .insert({
      tenant_id: input.tenant_id,
      promotion_code_id: (promo as any).id,
      code: (promo as any).code,
      name: (promo as any).name,
      description: (promo as any).description,
      discount_type: (promo as any).discount_type,
      discount_value: (promo as any).discount_value,
      currency: (promo as any).currency,
      scope: (promo as any).scope,
      app_code: (promo as any).app_code,
      plan_code: (promo as any).plan_code,
      source: "promo_code",
      starts_at: new Date().toISOString(),
      ends_at: (promo as any).ends_at,
      status: "active",
      stripe_coupon_id: (promo as any).stripe_coupon_id,
      stripe_promotion_code_id: (promo as any).stripe_promotion_code_id,
      applied_by: userId,
    } as never)
    .select("*")
    .single();
  if (iErr) throw new Error(iErr.message);

  await context.supabase
    .from("promotion_codes")
    .update({ redemption_count: ((promo as any).redemption_count ?? 0) + 1 })
    .eq("id", (promo as any).id);

  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.promo_redeemed",
    record_id: (inserted as any).id,
    payload: { code, mock: true },
  });

  return { ok: true as const, discount: inserted };
}

export type RemoveTenantDiscountInput = { tenant_id: string; discount_id: string };

export async function removeTenantDiscountServer(input: RemoveTenantDiscountInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);
  const { error } = await context.supabase
    .from("billing_discounts")
    .update({ status: "canceled", ends_at: new Date().toISOString() })
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.discount_id);
  if (error) throw new Error(error.message);
  await writeAudit(deps, { tenant_id: input.tenant_id, user_id: userId, action: "billing.discount_removed", record_id: input.discount_id });
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Referral Program
// ──────────────────────────────────────────────────────────────────────────────

function genReferralCode(orgName: string | null | undefined): { code: string; slug: string } {
  const base = (orgName ?? "org").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6) || "ORG";
  const rnd = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const yr = String(new Date().getFullYear()).slice(-2);
  const code = `${base}-${rnd}-${yr}`;
  return { code, slug: code.toLowerCase() };
}

export async function getReferralProgramServer(input: TenantInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertView(context.supabase, input.tenant_id, userId, deps.appCode);

  let { data: prog, error } = await context.supabase
    .from("referral_programs")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!prog) {
    const { data: tenant } = await context.supabase.from("tenants").select("name").eq("id", input.tenant_id).single();
    // try unique code up to 5 times
    for (let i = 0; i < 5 && !prog; i++) {
      const { code, slug } = genReferralCode(tenant?.name);
      const ins = await context.supabase
        .from("referral_programs")
        .insert({ tenant_id: input.tenant_id, code, slug } as never)
        .select("*")
        .single();
      if (!ins.error) prog = ins.data as any;
    }
    if (!prog) throw new Error("Failed to create referral program");
  }

  const { data: referrals } = await context.supabase
    .from("referrals")
    .select("*")
    .eq("referrer_tenant_id", input.tenant_id)
    .order("created_at", { ascending: false });

  return { program: prog, referrals: referrals ?? [] };
}

export type AddMockReferralInput = {
  tenant_id: string;
  referee_email: string;
  referee_org_name?: string;
  status: "pending" | "signed_up" | "subscribed";
};

export async function addMockReferralServer(input: AddMockReferralInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  const { data: prog } = await context.supabase
    .from("referral_programs")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  if (!prog) throw new Error("Referral program not initialized");

  const now = new Date().toISOString();
  const reward = input.status === "subscribed" ? (prog as any).reward_amount_cents : 0;

  const { data: row, error } = await context.supabase
    .from("referrals")
    .insert({
      referrer_tenant_id: input.tenant_id,
      code: (prog as any).code,
      referee_email: input.referee_email,
      referee_org_name: input.referee_org_name ?? null,
      status: input.status,
      reward_amount_cents: reward,
      reward_currency: (prog as any).reward_currency,
      signed_up_at: input.status !== "pending" ? now : null,
      subscribed_at: input.status === "subscribed" ? now : null,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (reward > 0) {
    await context.supabase
      .from("referral_programs")
      .update({ credit_available_cents: ((prog as any).credit_available_cents ?? 0) + reward })
      .eq("tenant_id", input.tenant_id);
  }

  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.referral_added",
    record_id: (row as any).id,
    payload: { status: input.status, mock: true },
  });

  return { ok: true, referral: row };
}

export type UpdateReferralStatusInput = {
  tenant_id: string;
  referral_id: string;
  status: "pending" | "signed_up" | "subscribed" | "canceled";
};

export async function updateReferralStatusServer(input: UpdateReferralStatusInput, context: BillingContext, deps: BillingDeps) {
  const userId = context.userId;
  await assertManage(context.supabase, input.tenant_id, userId, deps.appCode);

  const { data: existing } = await context.supabase
    .from("referrals")
    .select("*")
    .eq("id", input.referral_id)
    .eq("referrer_tenant_id", input.tenant_id)
    .maybeSingle();
  if (!existing) throw new Error("Referral not found");

  const { data: prog } = await context.supabase
    .from("referral_programs")
    .select("*")
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === "signed_up" && !(existing as any).signed_up_at) patch.signed_up_at = now;
  if (input.status === "subscribed") {
    if (!(existing as any).signed_up_at) patch.signed_up_at = now;
    patch.subscribed_at = now;
    if ((existing as any).reward_amount_cents === 0 && prog) {
      patch.reward_amount_cents = (prog as any).reward_amount_cents;
      await context.supabase
        .from("referral_programs")
        .update({ credit_available_cents: ((prog as any).credit_available_cents ?? 0) + (prog as any).reward_amount_cents })
        .eq("tenant_id", input.tenant_id);
    }
  }

  const { error } = await context.supabase.from("referrals").update(patch as never).eq("id", input.referral_id);
  if (error) throw new Error(error.message);

  await writeAudit(deps, {
    tenant_id: input.tenant_id,
    user_id: userId,
    action: "billing.referral_status_changed",
    record_id: input.referral_id,
    payload: { status: input.status, mock: true },
  });

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────────
// Usage & Limits
// ──────────────────────────────────────────────────────────────────────────────

type PlanLimits = {
  users: number | null;
  customers: number | null;
  invoices_per_month: number | null;
  storage_gb: number | null;
  projects: number | null;
  attachments: number | null;
};

const PLAN_LIMITS: Record<string, Record<string, PlanLimits>> = {
  joabooks: {
    free:     { users: 1,   customers: 25,    invoices_per_month: 10,   storage_gb: 0.5, projects: 3,    attachments: 100 },
    basic:    { users: 3,   customers: 500,   invoices_per_month: 50,   storage_gb: 2,   projects: 25,   attachments: 1000 },
    pro:      { users: 10,  customers: 5000,  invoices_per_month: 500,  storage_gb: 10,  projects: 250,  attachments: 10000 },
    business: { users: null, customers: null, invoices_per_month: null, storage_gb: 100, projects: null, attachments: null },
  },
};

function limitsFor(appCode: string, planCode: string): PlanLimits {
  return (
    PLAN_LIMITS[appCode]?.[planCode] ?? {
      users: 5, customers: 100, invoices_per_month: 25, storage_gb: 1, projects: 10, attachments: 200,
    }
  );
}

export type GetTenantUsageInput = { tenant_id: string; app_code?: string };

export async function getTenantUsageServer(input: GetTenantUsageInput, context: BillingContext, deps: BillingDeps) {
  await assertView(context.supabase, input.tenant_id, context.userId, deps.appCode);
  const appCode = input.app_code ?? "joabooks";

  const { data: sub } = await context.supabase
    .from("billing_subscriptions")
    .select("plan_code,status")
    .eq("tenant_id", input.tenant_id)
    .eq("app_code", appCode)
    .maybeSingle();
  const planCode = sub?.plan_code ?? "free";
  const limits = limitsFor(appCode, planCode);

  // Override hardcoded limits with DB-defined plan_features values
  const { data: pfRows } = await context.supabase
    .from("plan_features")
    .select("feature_key,value")
    .eq("app_code", appCode)
    .eq("plan_code", planCode);
  const featureMap: Record<string, unknown> = {};
  for (const r of pfRows ?? []) featureMap[(r as { feature_key: string }).feature_key] = (r as { value: unknown }).value;
  const num = (k: string) => {
    const v = featureMap[k];
    if (v === null || v === undefined || v === "" || v === "unlimited") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const mapping: Array<[keyof typeof limits, string, number?]> = [
    ["users", "max_users"],
    ["customers", "max_customers"],
    ["invoices_per_month", "max_invoices_per_month"],
    ["projects", "max_projects"],
    ["attachments", "max_attachments"],
    ["storage_gb", "storage_limit_mb", 1 / 1024],
  ];
  for (const [limitKey, featKey, scale] of mapping) {
    if (featKey in featureMap) {
      const raw = num(featKey);
      (limits as Record<string, number | null>)[limitKey as string] =
        raw === undefined ? null : scale ? +(raw * scale).toFixed(3) : raw;
    }
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [usersR, customersR, invoicesR, attachmentsR, attachmentsSizeR, appsR] = await Promise.all([
    context.supabase.from("tenant_users").select("user_id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id).eq("status", "active"),
    context.supabase.from("parties").select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id).eq("is_customer", true),
    context.supabase.from("invoices").select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id).gte("created_at", monthStart.toISOString()),
    context.supabase.from("attachments").select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id),
    context.supabase.from("attachments").select("size").eq("tenant_id", input.tenant_id),
    context.supabase.from("tenant_apps").select("app_code", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id).eq("status", "active"),
  ]);

  const storageBytes = (attachmentsSizeR.data ?? []).reduce(
    (s: number, r: { size: number | null }) => s + (r.size ?? 0),
    0,
  );

  return {
    app_code: appCode,
    plan_code: planCode,
    plan_status: sub?.status ?? "free",
    limits,
    usage: {
      users: usersR.count ?? 0,
      customers: customersR.count ?? 0,
      invoices_this_month: invoicesR.count ?? 0,
      attachments: attachmentsR.count ?? 0,
      storage_gb: +(storageBytes / 1024 / 1024 / 1024).toFixed(3),
      active_apps: appsR.count ?? 0,
      projects: 0,
    },
  };
}

// ─── Bundle Discount Rules (read-only) ───────────────────────────────────────
export async function listActiveBundleRulesServer(context: BillingContext) {
  const nowIso = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("billing_bundle_rules")
    .select("id,name,minimum_active_apps,discount_percent,starts_at,ends_at,active")
    .eq("active", true)
    .order("minimum_active_apps", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).filter((r: any) =>
    (!r.starts_at || r.starts_at <= nowIso) && (!r.ends_at || r.ends_at >= nowIso)
  );
}
