import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

export type BillingDeps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
};

type Role = string;

async function getRoles(deps: BillingDeps, tenantId: string, userId: string): Promise<Role[]> {
  const { data, error } = await deps.supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => r.role as string);
}

function canManage(roles: Role[]) {
  return roles.some((r) => r === "owner" || r === "super_admin" || r === "billing_admin");
}
function canView(roles: Role[]) {
  return canManage(roles) || roles.includes("finance_manager");
}

async function assertView(deps: BillingDeps, tenantId: string, userId: string) {
  const roles = await getRoles(deps, tenantId, userId);
  if (!canView(roles)) throw new Error("Forbidden: billing access not allowed for this role");
  return roles;
}
async function assertManage(deps: BillingDeps, tenantId: string, userId: string) {
  const roles = await getRoles(deps, tenantId, userId);
  if (!canManage(roles)) throw new Error("Forbidden: billing management requires Owner, Super Admin, or Billing Admin");
  return roles;
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

const tenantInput = z.object({ tenant_id: z.string().uuid() });

// ──────────────────────────────────────────────────────────────────────────────
// Permission helpers (client gating)
// ──────────────────────────────────────────────────────────────────────────────
export function createCanManageBillingFn(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const roles = await getRoles(deps, data.tenant_id, (context as any).userId);
      return { can_manage: canManage(roles), can_view: canView(roles), roles };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Overview
// ──────────────────────────────────────────────────────────────────────────────
export function createGetBillingOverview(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      const roles = await assertView(deps, data.tenant_id, userId);

      const [customerQ, subsQ, pmQ, tenantAppsQ, tenantQ] = await Promise.all([
        deps.supabaseAdmin.from("billing_customers").select("*").eq("tenant_id", data.tenant_id).maybeSingle(),
        deps.supabaseAdmin.from("billing_subscriptions").select("*").eq("tenant_id", data.tenant_id),
        deps.supabaseAdmin.from("billing_payment_methods").select("*").eq("tenant_id", data.tenant_id).order("is_default", { ascending: false }),
        deps.supabaseAdmin.from("tenant_apps").select("app_code, plan, status").eq("tenant_id", data.tenant_id).eq("status", "active"),
        deps.supabaseAdmin.from("tenants").select("id, name").eq("id", data.tenant_id).single(),
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
          tenant_id: data.tenant_id,
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
        const planRows = await deps.supabaseAdmin
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
        can_manage: canManage(roles),
        can_view: canView(roles),
      };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Customer details
// ──────────────────────────────────────────────────────────────────────────────
export function createUpdateBillingCustomer(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        billing_email: z.string().email().nullable().optional(),
        company_legal_name: z.string().max(200).nullable().optional(),
        tax_id: z.string().max(64).nullable().optional(),
        address_line1: z.string().max(200).nullable().optional(),
        address_line2: z.string().max(200).nullable().optional(),
        city: z.string().max(100).nullable().optional(),
        state: z.string().max(100).nullable().optional(),
        postal_code: z.string().max(20).nullable().optional(),
        country: z.string().max(2).nullable().optional(),
        default_currency: z.string().min(3).max(3).optional(),
        billing_phone: z.string().max(40).nullable().optional(),
        billing_contact_name: z.string().max(120).nullable().optional(),
        billing_contact_email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
        invoice_memo: z.string().max(1000).nullable().optional(),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const { tenant_id, ...patch } = data;
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_customers")
        .upsert({ tenant_id, ...patch }, { onConflict: "tenant_id" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id, user_id: userId, action: "billing.customer_updated", record_id: tenant_id, payload: patch });
      return row;
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Plans (public catalog — auth optional)
// ──────────────────────────────────────────────────────────────────────────────
export function createListBillingPlans(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .inputValidator((i) =>
      z.object({
        app_code: z.enum(APP_CODES).optional(),
        interval: z.enum(INTERVALS).optional(),
      }).parse(i ?? {}),
    )
    .handler(async ({ data }) => {
      let q = deps.supabaseAdmin.from("billing_plans").select("*").eq("is_active", true).order("app_code").order("sort_order");
      if (data.app_code) q = q.eq("app_code", data.app_code);
      if (data.interval) q = q.eq("interval", data.interval);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return rows ?? [];
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Subscriptions (mock mutations — no Stripe)
// ──────────────────────────────────────────────────────────────────────────────
export function createChangeSubscriptionPlan(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        app_code: z.enum(APP_CODES),
        plan_code: z.enum(PLAN_CODES),
        interval: z.enum(INTERVALS).default("month"),
        seats: z.number().int().min(1).max(1000).default(1),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      const now = new Date();
      const end = new Date(now);
      if (data.interval === "year") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);

      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .upsert(
          {
            tenant_id: data.tenant_id,
            app_code: data.app_code,
            plan_code: data.plan_code,
            interval: data.interval,
            seats: data.seats,
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

      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.plan_changed",
        record_id: row.id,
        payload: { app_code: data.app_code, plan_code: data.plan_code, interval: data.interval, seats: data.seats, mock: true },
      });
      return { ok: true, mock: true, subscription: row };
    });
}

export function createCancelSubscription(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        app_code: z.enum(APP_CODES),
        at_period_end: z.boolean().default(true),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      const update = data.at_period_end
        ? { cancel_at_period_end: true }
        : { cancel_at_period_end: true, status: "canceled" as const };

      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .update(update)
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", data.app_code)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);

      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.subscription_canceled",
        record_id: row?.id ?? null,
        payload: { app_code: data.app_code, at_period_end: data.at_period_end, mock: true },
      });
      return { ok: true, mock: true, subscription: row };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Invoices
// ──────────────────────────────────────────────────────────────────────────────
export function createListBillingInvoices(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertView(deps, data.tenant_id, (context as any).userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("billing_invoices")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .order("issued_at", { ascending: false })
        .limit(data.limit);
      if (error) throw new Error(error.message);
      return rows ?? [];
    });
}

export function createGetBillingInvoice(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await assertView(deps, data.tenant_id, (context as any).userId);
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_invoices")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.id)
        .single();
      if (error) throw new Error(error.message);
      return row;
    });
}

export function createRetryInvoicePayment(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      // Stripe not connected yet — record the intent only.
      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.invoice_retry_requested",
        record_id: data.id,
        payload: { mock: true, note: "Stripe integration coming later" },
      });
      return { ok: false, mock: true, message: "Stripe integration coming later" };
    });
}

export function createSeedSampleBillingInvoices(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      const { count } = await deps.supabaseAdmin
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", data.tenant_id);
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
          tenant_id: data.tenant_id, number: `INV-${yr}-0001`, app_code: "joabooks",
          amount_cents: 4900, amount_paid_cents: 4900, currency: "usd", status: "paid",
          issued_at: monthStart(2), due_at: monthEnd(2), paid_at: monthEnd(2),
          period_start: monthStart(2), period_end: monthEnd(2),
          description: "JoaBooks Business — monthly",
        },
        {
          tenant_id: data.tenant_id, number: `INV-${yr}-0002`, app_code: "joasop",
          amount_cents: 2900, amount_paid_cents: 2900, currency: "usd", status: "paid",
          issued_at: monthStart(1), due_at: monthEnd(1), paid_at: monthEnd(1),
          period_start: monthStart(1), period_end: monthEnd(1),
          description: "JoaSOP Pro — monthly",
        },
        {
          tenant_id: data.tenant_id, number: `INV-${yr}-0003`, app_code: "joabooks",
          amount_cents: 4900, amount_paid_cents: 0, currency: "usd", status: "open",
          issued_at: monthStart(0), due_at: monthEnd(0), paid_at: null,
          period_start: monthStart(0), period_end: monthEnd(0),
          description: "JoaBooks Business — monthly",
        },
        {
          tenant_id: data.tenant_id, number: `INV-${yr}-0004`, app_code: "joasop",
          amount_cents: 2900, amount_paid_cents: 0, currency: "usd", status: "failed",
          issued_at: monthStart(0), due_at: monthEnd(0), paid_at: null,
          period_start: monthStart(0), period_end: monthEnd(0),
          description: "JoaSOP Pro — monthly (card declined)",
        },
      ];
      const { error } = await deps.supabaseAdmin.from("billing_invoices").insert(rows as never);
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.invoices_seeded", payload: { count: rows.length } });
      return { ok: true, inserted: rows.length };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Payment methods (mock; display fields only)
// ──────────────────────────────────────────────────────────────────────────────
export function createListBillingPaymentMethods(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      await assertView(deps, data.tenant_id, (context as any).userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("billing_payment_methods")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    });
}

export function createAddMockPaymentMethod(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        brand: z.string().min(1).max(40),
        last4: z.string().regex(/^\d{4}$/, "last4 must be 4 digits"),
        exp_month: z.number().int().min(1).max(12),
        exp_year: z.number().int().min(2024).max(2100),
        make_default: z.boolean().default(true),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      if (data.make_default) {
        await deps.supabaseAdmin
          .from("billing_payment_methods")
          .update({ is_default: false })
          .eq("tenant_id", data.tenant_id);
      }
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_payment_methods")
        .insert({
          tenant_id: data.tenant_id,
          brand: data.brand,
          last4: data.last4,
          exp_month: data.exp_month,
          exp_year: data.exp_year,
          is_default: data.make_default,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.payment_method_added", record_id: row.id, payload: { brand: data.brand, last4: data.last4, mock: true } });
      return row;
    });
}

export function createSetDefaultPaymentMethod(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      await deps.supabaseAdmin
        .from("billing_payment_methods")
        .update({ is_default: false })
        .eq("tenant_id", data.tenant_id);
      const { error } = await deps.supabaseAdmin
        .from("billing_payment_methods")
        .update({ is_default: true })
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.payment_method_default", record_id: data.id });
      return { ok: true };
    });
}

export function createRemovePaymentMethod(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const { error } = await deps.supabaseAdmin
        .from("billing_payment_methods")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.payment_method_removed", record_id: data.id });
      return { ok: true };
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Trial / reactivate / add / remove (mock; no Stripe)
// ──────────────────────────────────────────────────────────────────────────────
export function createStartTrial(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        app_code: z.enum(APP_CODES),
        plan_code: z.enum(PLAN_CODES).default("pro"),
        interval: z.enum(INTERVALS).default("month"),
        trial_days: z.number().int().min(1).max(60).default(14),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const now = new Date();
      const end = new Date(now.getTime() + data.trial_days * 86_400_000);
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .upsert(
          {
            tenant_id: data.tenant_id,
            app_code: data.app_code,
            plan_code: data.plan_code,
            interval: data.interval,
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
      await deps.supabaseAdmin.from("tenant_apps").upsert(
        {
          tenant_id: data.tenant_id,
          app_code: data.app_code,
          plan: data.plan_code,
          status: "active",
          activated_at: now.toISOString(),
          canceled_at: null,
          deletion_scheduled_at: null,
        },
        { onConflict: "tenant_id,app_code" },
      );
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.trial_started", record_id: row.id, payload: { app_code: data.app_code, trial_days: data.trial_days, mock: true } });
      return { ok: true, mock: true, subscription: row };
    });
}

export function createReactivateSubscription(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), app_code: z.enum(APP_CODES) }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .update({ status: "active", cancel_at_period_end: false })
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", data.app_code)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      await deps.supabaseAdmin
        .from("tenant_apps")
        .update({ status: "active", canceled_at: null, deletion_scheduled_at: null })
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", data.app_code);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.subscription_reactivated", record_id: row?.id ?? null, payload: { app_code: data.app_code, mock: true } });
      return { ok: true, mock: true, subscription: row };
    });
}

export function createAddAppSubscription(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        app_code: z.enum(APP_CODES),
        plan_code: z.enum(PLAN_CODES).default("basic"),
        interval: z.enum(INTERVALS).default("month"),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const now = new Date();
      const end = new Date(now);
      if (data.interval === "year") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);
      const { data: row, error } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .upsert(
          {
            tenant_id: data.tenant_id,
            app_code: data.app_code,
            plan_code: data.plan_code,
            interval: data.interval,
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
      await deps.supabaseAdmin.from("tenant_apps").upsert(
        {
          tenant_id: data.tenant_id,
          app_code: data.app_code,
          plan: data.plan_code,
          status: "active",
          activated_at: now.toISOString(),
          canceled_at: null,
          deletion_scheduled_at: null,
        },
        { onConflict: "tenant_id,app_code" },
      );
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.app_added", record_id: row.id, payload: { app_code: data.app_code, plan_code: data.plan_code, mock: true } });
      return { ok: true, mock: true, subscription: row };
    });
}

export function createRemoveAppSubscription(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({ tenant_id: z.string().uuid(), app_code: z.enum(APP_CODES) }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      if (data.app_code === "joabooks") throw new Error("JoaBooks cannot be removed");
      await deps.supabaseAdmin
        .from("billing_subscriptions")
        .delete()
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", data.app_code);
      await deps.supabaseAdmin
        .from("tenant_apps")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", data.app_code);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.app_removed", payload: { app_code: data.app_code, mock: true } });
      return { ok: true, mock: true };
    });
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

export function createListAvailablePromotions(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertView(deps, data.tenant_id, userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("promotion_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows ?? []).map((r: any) => ({ ...r, computed_status: computePromoStatus(r) }));
    });
}

export function createListTenantDiscounts(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertView(deps, data.tenant_id, userId);
      const { data: rows, error } = await deps.supabaseAdmin
        .from("billing_discounts")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    });
}

const redeemInput = z.object({ tenant_id: z.string().uuid(), code: z.string().min(1).max(64) });

export function createRedeemPromoCode(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => redeemInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const code = data.code.trim().toUpperCase();

      const { data: promo, error: pErr } = await deps.supabaseAdmin
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

      const { data: existing } = await deps.supabaseAdmin
        .from("billing_discounts")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .eq("promotion_code_id", (promo as any).id)
        .eq("status", "active")
        .maybeSingle();
      if (existing) return { ok: false as const, reason: "already_applied" as const };

      const { data: inserted, error: iErr } = await deps.supabaseAdmin
        .from("billing_discounts")
        .insert({
          tenant_id: data.tenant_id,
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

      await deps.supabaseAdmin
        .from("promotion_codes")
        .update({ redemption_count: ((promo as any).redemption_count ?? 0) + 1 })
        .eq("id", (promo as any).id);

      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.promo_redeemed",
        record_id: (inserted as any).id,
        payload: { code, mock: true },
      });

      return { ok: true as const, discount: inserted };
    });
}

export function createRemoveTenantDiscount(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => z.object({ tenant_id: z.string().uuid(), discount_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);
      const { error } = await deps.supabaseAdmin
        .from("billing_discounts")
        .update({ status: "canceled", ends_at: new Date().toISOString() })
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.discount_id);
      if (error) throw new Error(error.message);
      await writeAudit(deps, { tenant_id: data.tenant_id, user_id: userId, action: "billing.discount_removed", record_id: data.discount_id });
      return { ok: true };
    });
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

export function createGetReferralProgram(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) => tenantInput.parse(i))
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertView(deps, data.tenant_id, userId);

      let { data: prog, error } = await deps.supabaseAdmin
        .from("referral_programs")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .maybeSingle();
      if (error) throw new Error(error.message);

      if (!prog) {
        const { data: tenant } = await deps.supabaseAdmin.from("tenants").select("name").eq("id", data.tenant_id).single();
        // try unique code up to 5 times
        for (let i = 0; i < 5 && !prog; i++) {
          const { code, slug } = genReferralCode(tenant?.name);
          const ins = await deps.supabaseAdmin
            .from("referral_programs")
            .insert({ tenant_id: data.tenant_id, code, slug } as never)
            .select("*")
            .single();
          if (!ins.error) prog = ins.data as any;
        }
        if (!prog) throw new Error("Failed to create referral program");
      }

      const { data: referrals } = await deps.supabaseAdmin
        .from("referrals")
        .select("*")
        .eq("referrer_tenant_id", data.tenant_id)
        .order("created_at", { ascending: false });

      return { program: prog, referrals: referrals ?? [] };
    });
}

export function createAddMockReferral(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        referee_email: z.string().email(),
        referee_org_name: z.string().min(1).max(120).optional(),
        status: z.enum(["pending", "signed_up", "subscribed"]).default("pending"),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      const { data: prog } = await deps.supabaseAdmin
        .from("referral_programs")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .maybeSingle();
      if (!prog) throw new Error("Referral program not initialized");

      const now = new Date().toISOString();
      const reward = data.status === "subscribed" ? (prog as any).reward_amount_cents : 0;

      const { data: row, error } = await deps.supabaseAdmin
        .from("referrals")
        .insert({
          referrer_tenant_id: data.tenant_id,
          code: (prog as any).code,
          referee_email: data.referee_email,
          referee_org_name: data.referee_org_name ?? null,
          status: data.status,
          reward_amount_cents: reward,
          reward_currency: (prog as any).reward_currency,
          signed_up_at: data.status !== "pending" ? now : null,
          subscribed_at: data.status === "subscribed" ? now : null,
        } as never)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      if (reward > 0) {
        await deps.supabaseAdmin
          .from("referral_programs")
          .update({ credit_available_cents: ((prog as any).credit_available_cents ?? 0) + reward })
          .eq("tenant_id", data.tenant_id);
      }

      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.referral_added",
        record_id: (row as any).id,
        payload: { status: data.status, mock: true },
      });

      return { ok: true, referral: row };
    });
}

export function createUpdateReferralStatus(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i) =>
      z.object({
        tenant_id: z.string().uuid(),
        referral_id: z.string().uuid(),
        status: z.enum(["pending", "signed_up", "subscribed", "canceled"]),
      }).parse(i),
    )
    .handler(async ({ data, context }) => {
      const userId = (context as any).userId as string;
      await assertManage(deps, data.tenant_id, userId);

      const { data: existing } = await deps.supabaseAdmin
        .from("referrals")
        .select("*")
        .eq("id", data.referral_id)
        .eq("referrer_tenant_id", data.tenant_id)
        .maybeSingle();
      if (!existing) throw new Error("Referral not found");

      const { data: prog } = await deps.supabaseAdmin
        .from("referral_programs")
        .select("*")
        .eq("tenant_id", data.tenant_id)
        .maybeSingle();

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: data.status };
      if (data.status === "signed_up" && !(existing as any).signed_up_at) patch.signed_up_at = now;
      if (data.status === "subscribed") {
        if (!(existing as any).signed_up_at) patch.signed_up_at = now;
        patch.subscribed_at = now;
        if ((existing as any).reward_amount_cents === 0 && prog) {
          patch.reward_amount_cents = (prog as any).reward_amount_cents;
          await deps.supabaseAdmin
            .from("referral_programs")
            .update({ credit_available_cents: ((prog as any).credit_available_cents ?? 0) + (prog as any).reward_amount_cents })
            .eq("tenant_id", data.tenant_id);
        }
      }

      const { error } = await deps.supabaseAdmin.from("referrals").update(patch as never).eq("id", data.referral_id);
      if (error) throw new Error(error.message);

      await writeAudit(deps, {
        tenant_id: data.tenant_id,
        user_id: userId,
        action: "billing.referral_status_changed",
        record_id: data.referral_id,
        payload: { status: data.status, mock: true },
      });

      return { ok: true };
    });
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

export function createGetTenantUsage(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((data: { tenant_id: string; app_code?: string }) => data)
    .handler(async ({ data, context }) => {
      await assertView(deps, data.tenant_id, (context as any).userId);
      const appCode = data.app_code ?? "joabooks";

      const { data: sub } = await deps.supabaseAdmin
        .from("billing_subscriptions")
        .select("plan_code,status")
        .eq("tenant_id", data.tenant_id)
        .eq("app_code", appCode)
        .maybeSingle();
      const planCode = sub?.plan_code ?? "free";
      const limits = limitsFor(appCode, planCode);

      // Override hardcoded limits with DB-defined plan_features values
      const { data: pfRows } = await deps.supabaseAdmin
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
        deps.supabaseAdmin.from("tenant_users").select("user_id", { count: "exact", head: true })
          .eq("tenant_id", data.tenant_id).eq("status", "active"),
        deps.supabaseAdmin.from("parties").select("id", { count: "exact", head: true })
          .eq("tenant_id", data.tenant_id).eq("is_customer", true),
        deps.supabaseAdmin.from("invoices").select("id", { count: "exact", head: true })
          .eq("tenant_id", data.tenant_id).gte("created_at", monthStart.toISOString()),
        deps.supabaseAdmin.from("attachments").select("id", { count: "exact", head: true })
          .eq("tenant_id", data.tenant_id),
        deps.supabaseAdmin.from("attachments").select("size").eq("tenant_id", data.tenant_id),
        deps.supabaseAdmin.from("tenant_apps").select("app_code", { count: "exact", head: true })
          .eq("tenant_id", data.tenant_id).eq("status", "active"),
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
    });
}

// ─── Bundle Discount Rules (read-only) ───────────────────────────────────────
export function createListActiveBundleRules(deps: BillingDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .handler(async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await deps.supabaseAdmin
        .from("billing_bundle_rules")
        .select("id,name,minimum_active_apps,discount_percent,starts_at,ends_at,active")
        .eq("active", true)
        .order("minimum_active_apps", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).filter((r: any) =>
        (!r.starts_at || r.starts_at <= nowIso) && (!r.ends_at || r.ends_at >= nowIso)
      );
    });
}
