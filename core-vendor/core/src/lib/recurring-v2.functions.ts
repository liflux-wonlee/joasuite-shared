import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =========================================================================
// Shared Recurring Transactions module (JoaBooks + JoaOffice)
// All access is scoped by RLS (tenant_has_app + role checks).
//
// Vendored byte-for-byte into other apps via joasuite-shared/core-vendor
// (see manifest.txt). APP_CODE is the one line that changes per app copy —
// everything else stays identical to the canonical JoaBooks source.
// =========================================================================

const APP_CODE: "joabooks" | "joaoffice" = "joabooks";
const APP_ORIGINS: Record<string, string> = {
  joabooks: "https://books.joasuite.com",
  joaoffice: "https://office.joasuite.com",
};
const REMINDER_ROLES_BY_APP: Record<string, string[]> = {
  joabooks: ["owner", "super_admin", "admin", "finance_ap", "finance_manager", "accountant"],
  joaoffice: ["owner", "super_admin", "admin", "hr_manager", "manager"],
};
const APP_LABEL_BY_APP: Record<string, string> = {
  joabooks: "JoaBooks",
  joaoffice: "JoaOffice",
};

const Direction = z.enum(["money_in", "money_out"]);
const Frequency = z.enum([
  "one_time", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom", "irregular",
]);
const AmountType = z.enum([
  "fixed", "estimated", "variable", "range", "historical_average",
  "same_month_last_year", "custom_plan", "budget", "manual",
]);
const ForecastMethod = z.enum([
  "manual", "fixed", "last_txn", "avg_3m", "avg_6m",
  "same_month_last_year", "max_6m", "range", "ai", "custom_plan",
]);
const Stage = z.enum(["forecast", "committed", "billed", "paid"]);
const Priority = z.enum(["critical", "high", "normal", "low", "optional"]);
const Status = z.enum([
  "active", "paused", "ended", "draft", "needs_review", "cancel_planned", "cancelled",
]);
const RecurringType = z.enum([
  "subscription", "utility", "insurance", "rent", "lease", "loan_payment",
  "interest", "payroll", "wage", "tax", "fee", "maintenance", "advertising",
  "software", "professional_service", "budget", "recurring_income",
  "other_expense", "other_income",
]);

const PlanLineInput = z.object({
  line_no: z.number().int().min(1),
  due_date: z.string(),
  amount: z.number(),
  note: z.string().nullable().optional(),
  stage: Stage.nullable().optional(),
  priority: Priority.nullable().optional(),
});

const RecurringInput = z.object({
  tenant_id: z.string().uuid(),
  source_app: z.enum(["joabooks", "joaoffice"]).default("joabooks"),
  name: z.string().min(1).max(200),
  direction: Direction,
  type: RecurringType.default("other_expense"),
  party_id: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  status: Status.default("active"),
  amount_type: AmountType.default("fixed"),
  amount: z.number().nullable().optional(),
  amount_min: z.number().nullable().optional(),
  amount_max: z.number().nullable().optional(),
  currency_code: z.string().default("USD"),
  forecast_method: ForecastMethod.default("fixed"),
  forecast_confidence: z.enum(["high", "medium", "low", "uncertain"]).default("medium"),
  forecast_tag: z.string().nullable().optional(),
  frequency: Frequency.default("monthly"),
  start_date: z.string().nullable().optional(),
  next_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_account_id: z.string().uuid().nullable().optional(),
  credit_card_last4: z.string().nullable().optional(),
  bank_memo: z.string().nullable().optional(),
  autopay: z.boolean().default(false),
  payment_instructions: z.string().nullable().optional(),
  renewal_date: z.string().nullable().optional(),
  cancellation_deadline: z.string().nullable().optional(),
  reminder_days_before: z.number().int().nullable().optional(),
  auto_renew: z.boolean().default(false),
  review_needed: z.boolean().default(false),
  usage_status: z.string().nullable().optional(),
  stage: Stage.default("forecast"),
  priority: Priority.default("normal"),
  forecast_included: z.boolean().default(true),
  planned_payment_date: z.string().nullable().optional(),
  must_pay_by: z.string().nullable().optional(),
  can_defer: z.boolean().default(false),
  defer_until: z.string().nullable().optional(),
  subscription_meta: z.record(z.string(), z.any()).default({}),
  insurance_meta: z.record(z.string(), z.any()).default({}),
  payroll_meta: z.record(z.string(), z.any()).default({}),
  plan_lines: z.array(PlanLineInput).default([]),
});

// ------------------------- helpers -------------------------

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function forecastAmountFor(r: {
  amount_type: string; amount: number | null; amount_min: number | null; amount_max: number | null;
}): number {
  switch (r.amount_type) {
    case "range":
      return ((r.amount_min ?? 0) + (r.amount_max ?? 0)) / 2;
    case "fixed":
    case "estimated":
    case "budget":
    case "manual":
    case "variable":
    case "historical_average":
    case "same_month_last_year":
    default:
      return r.amount ?? 0;
  }
}

function normalizeAnchor(iso: string, frequency: string): string {
  if (frequency !== "semi_monthly") return iso;
  // Snap to nearest 1st or 15th on/after iso.
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  if (day === 1 || day === 15) return iso;
  if (day < 15) {
    d.setUTCDate(15);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1, 1);
  }
  return d.toISOString().slice(0, 10);
}

function buildOccurrenceDates(
  frequency: string,
  startDate: string | null,
  nextDate: string | null,
  endDate: string | null,
  dueDay: number | null,
  windowStart: string,
  windowEnd: string,
): string[] {
  if (!frequency || frequency === "one_time" || frequency === "irregular" || frequency === "custom") return [];
  // Anchor the series at start_date (the true series definition).
  // next_date is just a cached "next due" pointer and can drift; using it as
  // the anchor causes occurrences before next_date to be skipped permanently.
  const rawAnchor = startDate || nextDate;
  if (!rawAnchor) return [];
  const anchor = normalizeAnchor(rawAnchor, frequency);
  const dates: string[] = [];
  let cur = anchor;
  // walk backwards if anchor is past windowStart
  // First fast-forward
  let safety = 0;
  while (cur < windowStart && safety++ < 1000) {
    cur = advance(cur, frequency, dueDay);
  }
  // Also rewind if needed (start of window before anchor) — we want anchor itself if it's in range
  // Now collect
  safety = 0;
  while (cur <= windowEnd && safety++ < 500) {
    if (endDate && cur > endDate) break;
    if (cur >= windowStart) dates.push(cur);
    cur = advance(cur, frequency, dueDay);
  }
  return dates;
}


function advance(iso: string, frequency: string, dueDay: number | null): string {
  switch (frequency) {
    case "weekly": return addDays(iso, 7);
    case "biweekly": return addDays(iso, 14);
    case "semi_monthly": {
      // Twice a month: 1st & 15th convention. If current day < 15, jump to 15th of same month; else jump to 1st of next month.
      const d = new Date(iso + "T00:00:00Z");
      const day = d.getUTCDate();
      if (day < 15) {
        d.setUTCDate(15);
      } else {
        d.setUTCMonth(d.getUTCMonth() + 1, 1);
      }
      return d.toISOString().slice(0, 10);
    }
    case "monthly": {
      const next = addMonths(iso, 1);
      if (dueDay) {
        const d = new Date(next + "T00:00:00Z");
        const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(dueDay, last));
        return d.toISOString().slice(0, 10);
      }
      return next;
    }
    case "quarterly": return addMonths(iso, 3);
    case "yearly": return addMonths(iso, 12);
    default: return addDays(iso, 30);
  }
}

async function regenerateOccurrencesFor(
  supabase: any, tenantId: string, recurringId: string,
) {
  const { data: r, error: rErr } = await supabase
    .from("recurring_transactions").select("*").eq("id", recurringId).single();
  if (rErr) throw new Error(rErr.message);

  const windowStart = addMonths(todayIso(), -1);
  const windowEnd = addMonths(todayIso(), 12);

  // Delete only forward-looking forecasted occurrences (preserve linked/paid history)
  await supabase
    .from("recurring_occurrences")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("recurring_id", recurringId)
    .eq("status", "forecasted")
    .gte("occurrence_date", windowStart);

  // Build rows
  let rows: any[] = [];
  if (r.amount_type === "custom_plan" || r.frequency === "custom") {
    const { data: lines } = await supabase
      .from("recurring_payment_plan_lines")
      .select("*").eq("recurring_id", recurringId)
      .gte("due_date", windowStart).lte("due_date", windowEnd);
    rows = (lines ?? []).map((l: any) => ({
      tenant_id: tenantId,
      recurring_id: recurringId,
      occurrence_date: l.due_date,
      direction: r.direction,
      forecast_amount: l.amount,
      currency_code: r.currency_code,
      stage: l.stage ?? r.stage,
      priority: l.priority ?? r.priority,
      forecast_included: r.forecast_included,
      forecast_confidence: r.forecast_confidence,
      status: "forecasted" as const,
      note: l.note,
    }));
  } else {
    const dates = buildOccurrenceDates(
      r.frequency, r.start_date, r.next_date, r.end_date,
      r.due_day, windowStart, windowEnd,
    );
    const amt = forecastAmountFor(r);
    rows = dates.map((d) => ({
      tenant_id: tenantId,
      recurring_id: recurringId,
      occurrence_date: d,
      direction: r.direction,
      forecast_amount: amt,
      currency_code: r.currency_code,
      stage: r.stage,
      priority: r.priority,
      forecast_included: r.forecast_included,
      forecast_confidence: r.forecast_confidence,
      status: "forecasted" as const,
    }));
  }

  // Avoid duplicating dates that already exist for this recurring (any status)
  if (rows.length > 0) {
    const { data: existing } = await supabase
      .from("recurring_occurrences")
      .select("occurrence_date")
      .eq("recurring_id", recurringId);
    const taken = new Set((existing ?? []).map((e: any) => e.occurrence_date));
    rows = rows.filter((row) => !taken.has(row.occurrence_date));
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from("recurring_occurrences")
      .upsert(rows, { onConflict: "recurring_id,occurrence_date", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  // For custom / custom_plan schedules the master row's next_date is not
  // derivable from a cadence rule — sync it to the earliest upcoming
  // forecasted occurrence so the detail header reflects the real plan.
  if (r.frequency === "custom" || r.amount_type === "custom_plan") {
    const { data: nextOcc } = await supabase
      .from("recurring_occurrences")
      .select("occurrence_date")
      .eq("recurring_id", recurringId)
      .eq("status", "forecasted")
      .gte("occurrence_date", todayIso())
      .order("occurrence_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    const newNext = nextOcc?.occurrence_date ?? null;
    if (newNext !== r.next_date) {
      await supabase
        .from("recurring_transactions")
        .update({ next_date: newNext })
        .eq("id", recurringId);
    }
  }

  return rows.length;
}

// ------------------------- CRUD -------------------------

export const listRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    tenant_id: z.string().uuid(),
    source_app: z.enum(["joabooks", "joaoffice"]).optional(),
    direction: Direction.optional(),
    status: Status.optional(),
    stage: Stage.optional(),
    party_id: z.string().uuid().optional(),
    search: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("recurring_transactions")
      .select("*, parties:party_id(id,name_en)")
      .eq("tenant_id", data.tenant_id)
      .order("next_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (data.source_app) q = q.eq("source_app", data.source_app);
    if (data.direction) q = q.eq("direction", data.direction);
    if (data.status) q = q.eq("status", data.status);
    if (data.stage) q = q.eq("stage", data.stage);
    if (data.party_id) q = q.eq("party_id", data.party_id);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return list;

    // Attach overdue aggregates (unresolved forecasted occurrences dated
    // before today) so the list can show a badge without a second round trip.
    const { data: overdueRows, error: overdueErr } = await context.supabase
      .from("recurring_occurrences")
      .select("recurring_id, forecast_amount")
      .eq("tenant_id", data.tenant_id)
      .eq("status", "forecasted")
      .lt("occurrence_date", todayIso())
      .in("recurring_id", list.map((r: any) => r.id));
    if (overdueErr) throw new Error(overdueErr.message);

    const overdueByRecurring = new Map<string, { count: number; amount: number }>();
    for (const o of overdueRows ?? []) {
      const cur = overdueByRecurring.get(o.recurring_id) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(o.forecast_amount ?? 0);
      overdueByRecurring.set(o.recurring_id, cur);
    }

    return list.map((r: any) => ({
      ...r,
      overdue_count: overdueByRecurring.get(r.id)?.count ?? 0,
      overdue_amount: overdueByRecurring.get(r.id)?.amount ?? 0,
    }));
  });

export const getRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("recurring_transactions")
      .select("*, parties:party_id(id,name_en)")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: lines } = await context.supabase
      .from("recurring_payment_plan_lines")
      .select("*").eq("recurring_id", data.id).order("line_no");
    const { data: occs } = await context.supabase
      .from("recurring_occurrences")
      .select("*").eq("recurring_id", data.id).order("occurrence_date");
    return { recurring: row, plan_lines: lines ?? [], occurrences: occs ?? [] };
  });

export const createRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RecurringInput.parse(i))
  .handler(async ({ data, context }) => {
    const { plan_lines, ...master } = data;
    const { data: row, error } = await context.supabase
      .from("recurring_transactions")
      .insert({ ...master, created_by: context.userId })
      .select().single();
    if (error) throw new Error(error.message);

    if (plan_lines.length > 0) {
      const rows = plan_lines.map((l) => ({
        ...l, tenant_id: data.tenant_id, recurring_id: row.id,
      }));
      const { error: lErr } = await context.supabase
        .from("recurring_payment_plan_lines").insert(rows);
      if (lErr) throw new Error(lErr.message);
    }
    await regenerateOccurrencesFor(context.supabase, data.tenant_id, row.id);
    return row;
  });

export const updateRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    patch: RecurringInput.partial().omit({ tenant_id: true, plan_lines: true }),
    plan_lines: z.array(PlanLineInput).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("recurring_transactions")
      .update(data.patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);

    if (data.plan_lines) {
      await context.supabase.from("recurring_payment_plan_lines")
        .delete().eq("recurring_id", data.id);
      if (data.plan_lines.length > 0) {
        const rows = data.plan_lines.map((l) => ({
          ...l, tenant_id: row.tenant_id, recurring_id: row.id,
        }));
        const { error: lErr } = await context.supabase
          .from("recurring_payment_plan_lines").insert(rows);
        if (lErr) throw new Error(lErr.message);
      }
    }
    await regenerateOccurrencesFor(context.supabase, row.tenant_id, row.id);
    return row;
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Check if any occurrence is linked to actual docs
    const { data: linked } = await context.supabase
      .from("recurring_occurrences")
      .select("id")
      .eq("recurring_id", data.id)
      .not("linked_id", "is", null)
      .limit(1);
    if (linked && linked.length > 0) {
      // Soft cancel to preserve history
      const { error } = await context.supabase
        .from("recurring_transactions")
        .update({ status: "cancelled" }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { soft: true };
    }
    const { error } = await context.supabase
      .from("recurring_transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { soft: false };
  });

export const regenerateRecurringOccurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), tenant_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const n = await regenerateOccurrencesFor(context.supabase, data.tenant_id, data.id);
    return { generated: n };
  });

export const setRecurringStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), stage: Stage }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_transactions").update({ stage: data.stage }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRecurringPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), priority: Priority }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_transactions").update({ priority: data.priority }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRecurringStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), status: Status }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_transactions").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const linkOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    occurrence_id: z.string().uuid(),
    linked_kind: z.enum(["bill", "payment_request", "expense", "transaction", "invoice"]),
    linked_id: z.string().uuid(),
    actual_amount: z.number().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const statusMap: Record<string, string> = {
      bill: "linked_bill",
      payment_request: "linked_payment_request",
      expense: "linked_expense",
      transaction: "linked_transaction",
      invoice: "linked_transaction",
    };
    const patch: any = {
      linked_kind: data.linked_kind,
      linked_id: data.linked_id,
      status: statusMap[data.linked_kind],
    };
    if (data.actual_amount !== undefined) patch.actual_amount = data.actual_amount;
    const { error } = await context.supabase
      .from("recurring_occurrences").update(patch).eq("id", data.occurrence_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unlinkOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ occurrence_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_occurrences")
      .update({ linked_kind: null, linked_id: null, actual_amount: null, status: "forecasted" })
      .eq("id", data.occurrence_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Mark an occurrence as paid/collected directly, without linking it to a real
// bill/payment_request/expense/transaction row (e.g. an autopay charge or a
// bank transfer that was already recorded elsewhere). Distinct from the
// linked_* statuses set by linkOccurrence.
export const markOccurrencePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    occurrence_id: z.string().uuid(),
    actual_amount: z.number().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: occ, error: occErr } = await context.supabase
      .from("recurring_occurrences")
      .select("id, recurring_id, forecast_amount, occurrence_date")
      .eq("id", data.occurrence_id)
      .single();
    if (occErr) throw new Error(occErr.message);

    const { error } = await context.supabase
      .from("recurring_occurrences")
      .update({
        status: "paid",
        actual_amount: data.actual_amount ?? occ.forecast_amount,
      })
      .eq("id", data.occurrence_id);
    if (error) throw new Error(error.message);

    // Advance parent next_date if this occurrence was the current one
    // (same rule as convertOccurrenceToDoc, so "paid" and "converted" behave
    // identically from the schedule's point of view).
    const { data: r } = await context.supabase
      .from("recurring_transactions")
      .select("next_date, frequency, due_day")
      .eq("id", occ.recurring_id)
      .maybeSingle();
    if (r?.next_date && occ.occurrence_date >= r.next_date) {
      const newNext = advance(occ.occurrence_date, r.frequency, r.due_day);
      await context.supabase
        .from("recurring_transactions")
        .update({ next_date: newNext })
        .eq("id", occ.recurring_id);
    }

    return { ok: true };
  });

// ------------------------- Cash Flow Forecast (scoped to the current app) -------------------------

export const getCashFlowForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    tenant_id: z.string().uuid(),
    from_date: z.string(),
    to_date: z.string(),
    include_committed: z.boolean().default(true),
    include_forecast: z.boolean().default(true),
    include_actuals: z.boolean().default(true),
    opening_balance: z.number().default(0),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Gate: tenant must have the current app (JoaOffice's copy checks its own
    // subscription, not JoaBooks' — Cash Flow is scoped to each app's own rows).
    const { data: hasApp } = await context.supabase
      .rpc("tenant_has_app", { _tenant: data.tenant_id, _app_code: APP_CODE });
    if (!hasApp) throw new Error(`Cash Flow Manage requires a ${APP_LABEL_BY_APP[APP_CODE]} subscription`);

    // Pull recurring occurrences in range
    const { data: occs, error } = await context.supabase
      .from("recurring_occurrences")
      .select("occurrence_date, direction, forecast_amount, actual_amount, stage, status, forecast_included, priority, recurring_id, recurring_transactions:recurring_id(name,type,party_id)")
      .eq("tenant_id", data.tenant_id)
      .gte("occurrence_date", data.from_date)
      .lte("occurrence_date", data.to_date)
      .eq("forecast_included", true);
    if (error) throw new Error(error.message);

    // Group by date
    const byDate: Record<string, {
      date: string;
      money_in: number; money_out: number; net: number; running: number;
      items: any[];
    }> = {};

    for (const o of occs ?? []) {
      if (o.stage === "forecast" && !data.include_forecast) continue;
      if (o.stage === "committed" && !data.include_committed) continue;
      if ((o.stage === "billed" || o.stage === "paid") && !data.include_actuals) continue;
      const amt = Number(o.actual_amount ?? o.forecast_amount ?? 0);
      const d = o.occurrence_date;
      if (!byDate[d]) byDate[d] = { date: d, money_in: 0, money_out: 0, net: 0, running: 0, items: [] };
      if (o.direction === "money_in") byDate[d].money_in += amt;
      else byDate[d].money_out += amt;
      byDate[d].items.push(o);
    }

    // Sort and accumulate
    const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    let running = data.opening_balance;
    for (const r of rows) {
      r.net = r.money_in - r.money_out;
      running += r.net;
      r.running = running;
    }

    const totals = rows.reduce((acc, r) => ({
      money_in: acc.money_in + r.money_in,
      money_out: acc.money_out + r.money_out,
      net: acc.net + r.net,
    }), { money_in: 0, money_out: 0, net: 0 });

    // Monthly aggregate: forecast (stage in forecast/committed) vs actual (billed/paid OR has actual_amount)
    const byMonth: Record<string, { month: string; forecast_in: number; forecast_out: number; actual_in: number; actual_out: number }> = {};
    for (const o of occs ?? []) {
      const m = (o.occurrence_date as string).slice(0, 7); // YYYY-MM
      if (!byMonth[m]) byMonth[m] = { month: m, forecast_in: 0, forecast_out: 0, actual_in: 0, actual_out: 0 };
      const fAmt = Number(o.forecast_amount ?? 0);
      const aAmt = o.actual_amount != null ? Number(o.actual_amount) : 0;
      const isActual = o.actual_amount != null || o.stage === "billed" || o.stage === "paid";
      if (o.direction === "money_in") {
        byMonth[m].forecast_in += fAmt;
        if (isActual) byMonth[m].actual_in += aAmt || fAmt;
      } else {
        byMonth[m].forecast_out += fAmt;
        if (isActual) byMonth[m].actual_out += aAmt || fAmt;
      }
    }
    const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

    // Overdue bucket: forecasted occurrences dated before today, regardless of
    // the requested from/to window — otherwise an unpaid item just falls out
    // of a forward-looking range and silently disappears from the forecast.
    const today = todayIso();
    const { data: overdueRows, error: overdueErr } = await context.supabase
      .from("recurring_occurrences")
      .select("id, occurrence_date, direction, forecast_amount, priority, recurring_id, recurring_transactions:recurring_id(name,type,party_id)")
      .eq("tenant_id", data.tenant_id)
      .eq("status", "forecasted")
      .eq("forecast_included", true)
      .lt("occurrence_date", today)
      .order("priority", { ascending: true })
      .order("occurrence_date", { ascending: true });
    if (overdueErr) throw new Error(overdueErr.message);

    const priorityRank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3, optional: 4 };
    const overdueItems = (overdueRows ?? [])
      .map((o: any) => ({
        ...o,
        days_overdue: Math.round((new Date(today).getTime() - new Date(o.occurrence_date).getTime()) / 86_400_000),
      }))
      .sort((a: any, b: any) =>
        (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
        || b.days_overdue - a.days_overdue
        || Number(b.forecast_amount ?? 0) - Number(a.forecast_amount ?? 0),
      );
    const overdueBucket = {
      pay_total: overdueItems.filter((o: any) => o.direction === "money_out").reduce((s: number, o: any) => s + Number(o.forecast_amount ?? 0), 0),
      collect_total: overdueItems.filter((o: any) => o.direction === "money_in").reduce((s: number, o: any) => s + Number(o.forecast_amount ?? 0), 0),
      pay_count: overdueItems.filter((o: any) => o.direction === "money_out").length,
      collect_count: overdueItems.filter((o: any) => o.direction === "money_in").length,
      items: overdueItems,
    };

    return { rows, totals, months, ending_balance: running, opening_balance: data.opening_balance, overdue: overdueBucket };
  });

// ------------------------- Reminder log (per recurring) -------------------------

export const listRecurringReminderLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ recurring_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("recurring_reminder_log")
      .select("*")
      .eq("recurring_id", data.recurring_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ------------------------- Convert occurrence -> real doc -------------------------

const ConvertKind = z.enum(["bill", "expense", "payment_request"]);

export const convertOccurrenceToDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    occurrence_id: z.string().uuid(),
    target_kind: ConvertKind,
    doc_date: z.string().optional(),     // bill_date / expense_date / due_date
    amount: z.number().nonnegative().optional(),
    detail: z.string().max(2000).optional(),
    note: z.string().max(2000).optional(),
    // expense-specific
    payment_method: z.string().max(40).optional(),
    payment_account_id: z.string().uuid().nullable().optional(),
    already_paid: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Load occurrence + recurring
    const { data: occ, error: occErr } = await context.supabase
      .from("recurring_occurrences")
      .select("*, recurring_transactions:recurring_id(*)")
      .eq("id", data.occurrence_id).single();
    if (occErr) throw new Error(occErr.message);
    if (!occ) throw new Error("Occurrence not found");
    if (occ.linked_id) throw new Error("This occurrence is already linked to a document");

    const r: any = occ.recurring_transactions;
    if (!r) throw new Error("Parent recurring transaction not found");

    const tenantId: string = occ.tenant_id;
    const userId = context.userId;
    const amount = Number(data.amount ?? occ.actual_amount ?? occ.forecast_amount ?? 0);
    const docDate = data.doc_date ?? occ.occurrence_date;
    const detail = data.detail ?? r.description ?? r.name ?? "";
    const note = data.note ?? "";

    if (data.target_kind === "payment_request") {
      // PR creation flow is complex (party bank, signature, approvers).
      // Return a prefill URL so the UI navigates to the New PR form.
      const params = new URLSearchParams({
        from: "recurring_occurrence",
        from_id: data.occurrence_id,
        name: r.name ?? "",
        party_id: r.party_id ?? "",
        amount: String(amount),
        currency_code: r.currency_code ?? "USD",
        description: detail,
      });
      return {
        kind: "redirect" as const,
        path: `/app/payment-requests/new?${params.toString()}`,
      };
    }

    // Direct create for bill / expense via supabaseAdmin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Permission gate: internal staff only (matches createBill/createExpense)
    const { data: isStaff, error: roleErr } = await supabaseAdmin.rpc("is_internal_staff", {
      _tenant: tenantId, _user: userId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isStaff) throw new Error("Internal staff role required");

    const { data: docNo, error: nErr } = await supabaseAdmin.rpc("next_doc_number", {
      _tenant: tenantId,
      _doc_type: data.target_kind,
    });
    if (nErr) throw new Error(nErr.message);

    let newId: string;
    let linkedKind: "bill" | "expense";
    let newStatus: "linked_bill" | "linked_expense";

    if (data.target_kind === "bill") {
      const { data: row, error } = await supabaseAdmin
        .from("bills")
        .insert({
          tenant_id: tenantId,
          bill_no: docNo as unknown as string,
          status: "submitted",
          party_id: r.party_id ?? null,
          bill_date: docDate,
          due_date: r.must_pay_by ?? null,
          amount_usd: amount,
          detail,
          note,
          created_by: userId,
        })
        .select("id").single();
      if (error) throw new Error(error.message);
      newId = row.id as string;
      linkedKind = "bill";
      newStatus = "linked_bill";

      // single line w/ recurring's category
      await supabaseAdmin.from("document_lines").insert({
        tenant_id: tenantId,
        doc_kind: "bill",
        doc_id: newId,
        category_id: r.category_id ?? null,
        description: detail,
        amount,
        note,
        sort_order: 0,
      });
    } else {
      const status = data.already_paid ? "paid" : "submitted";
      const { data: row, error } = await supabaseAdmin
        .from("expenses")
        .insert({
          tenant_id: tenantId,
          expense_no: docNo as unknown as string,
          status,
          party_id: r.party_id ?? null,
          expense_date: docDate,
          amount_usd: amount,
          payment_method: data.payment_method ?? r.payment_method ?? null,
          payment_account_id: data.payment_account_id ?? r.payment_account_id ?? null,
          fee: 0,
          detail,
          note,
          created_by: userId,
        })
        .select("id, expense_no").single();
      if (error) throw new Error(error.message);
      newId = row.id as string;
      linkedKind = "expense";
      newStatus = "linked_expense";

      await supabaseAdmin.from("document_lines").insert({
        tenant_id: tenantId,
        doc_kind: "expense",
        doc_id: newId,
        category_id: r.category_id ?? null,
        description: detail,
        amount,
        note,
        sort_order: 0,
      });

      if (data.already_paid) {
        const { data: txnNo, error: tnErr } = await supabaseAdmin.rpc("next_doc_number", {
          _tenant: tenantId, _doc_type: "transaction",
        });
        if (tnErr) throw new Error(tnErr.message);
        const { data: txn, error: tErr } = await supabaseAdmin
          .from("transactions")
          .insert({
            tenant_id: tenantId,
            txn_no: txnNo as unknown as string,
            txn_date: docDate,
            direction: "out",
            party_id: r.party_id ?? null,
            description: detail || `Expense ${row.expense_no}`,
            amount,
            fee: 0,
            category_id: r.category_id ?? null,
            payment_method: data.payment_method ?? r.payment_method ?? null,
            payment_account_id: data.payment_account_id ?? r.payment_account_id ?? null,
            status: "recorded",
            source_kind: "expense",
            source_id: newId,
            created_by: userId,
            paid_by: userId,
          })
          .select("id").single();
        if (tErr) throw new Error(tErr.message);
        await supabaseAdmin.from("transaction_lines").insert({
          tenant_id: tenantId,
          transaction_id: txn.id,
          category_id: r.category_id ?? null,
          description: detail,
          amount,
          note,
          sort_order: 0,
        });
      }
    }

    // Link occurrence
    const { error: linkErr } = await supabaseAdmin
      .from("recurring_occurrences")
      .update({
        linked_kind: linkedKind,
        linked_id: newId,
        actual_amount: amount,
        status: newStatus,
        stage: (linkedKind === "expense" && data.already_paid ? "paid" : "billed") as "paid" | "billed",
      })
      .eq("id", data.occurrence_id);
    if (linkErr) throw new Error(linkErr.message);

    // Advance parent next_date if this occurrence was the current one
    if (r.next_date && occ.occurrence_date >= r.next_date) {
      const newNext = advance(occ.occurrence_date, r.frequency, r.due_day);
      await supabaseAdmin
        .from("recurring_transactions")
        .update({ next_date: newNext })
        .eq("id", r.id);
    }

    return {
      kind: "created" as const,
      target: linkedKind,
      id: newId,
      path: linkedKind === "bill" ? `/app/bills/${newId}` : `/app/expenses/${newId}`,
    };
  });

// ============================================================
// Reminder processor: must_pay_by / cancellation_deadline
// Called daily by /api/public/hooks/recurring-reminders (no auth middleware
// so it can run from pg_cron). Idempotent via recurring_reminder_log.
// ============================================================

type ReminderKind = "must_pay_by" | "cancellation_deadline";
type Milestone = "advance" | "one_day" | "due";

function daysBetween(a: Date, b: Date) {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
    - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

export async function runRecurringRemindersImpl(now: Date = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail } = await import("@/lib/email.server");

  const todayISO = now.toISOString().slice(0, 10);
  const horizonISO = new Date(now.getTime() + 45 * 86400000).toISOString().slice(0, 10);

  // Pull active recurring rows with at least one of the milestone dates in the next 45 days.
  const { data: rows, error } = await supabaseAdmin
    .from("recurring_transactions")
    .select("id, tenant_id, name, currency_code, amount, party_id, owner_user_id, must_pay_by, cancellation_deadline, reminder_days_before, autopay")
    .eq("status", "active")
    .or(
      `and(must_pay_by.gte.${todayISO},must_pay_by.lte.${horizonISO}),and(cancellation_deadline.gte.${todayISO},cancellation_deadline.lte.${horizonISO})`,
    );
  if (error) throw new Error(error.message);

  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows ?? []) {
    const advanceDays = Math.max(1, Number(r.reminder_days_before ?? 7));

    const tasks: Array<{ kind: ReminderKind; targetDate: string }> = [];
    if (r.must_pay_by) tasks.push({ kind: "must_pay_by", targetDate: r.must_pay_by as string });
    if (r.cancellation_deadline) tasks.push({ kind: "cancellation_deadline", targetDate: r.cancellation_deadline as string });

    for (const t of tasks) {
      const target = new Date(t.targetDate + "T00:00:00Z");
      const diff = daysBetween(now, target);
      let milestone: Milestone | null = null;
      if (diff === advanceDays) milestone = "advance";
      else if (diff === 1) milestone = "one_day";
      else if (diff === 0) milestone = "due";
      if (!milestone) continue;

      // Dedup
      const { error: insErr } = await supabaseAdmin
        .from("recurring_reminder_log")
        .insert({
          tenant_id: r.tenant_id,
          recurring_id: r.id,
          kind: t.kind,
          target_date: t.targetDate,
          milestone,
        });
      if (insErr) {
        // Unique violation = already sent
        if (String(insErr.message).includes("duplicate")) { skipped++; continue; }
        errors.push(insErr.message);
        continue;
      }

      // Resolve recipients: owner + finance roles
      const recipientIds = new Set<string>();
      if (r.owner_user_id) recipientIds.add(r.owner_user_id as string);
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", r.tenant_id)
        .in("role", REMINDER_ROLES_BY_APP[APP_CODE] as any);
      for (const rr of roleRows ?? []) recipientIds.add(rr.user_id as string);

      if (recipientIds.size === 0) continue;

      const kindLabel = t.kind === "must_pay_by" ? "Payment due" : "Cancellation deadline";
      const milestoneLabel =
        milestone === "advance" ? `in ${advanceDays} days`
        : milestone === "one_day" ? "tomorrow"
        : "today";
      const title = `${kindLabel} ${milestoneLabel}: ${r.name}`;
      const amountStr = r.amount != null ? ` (${r.currency_code} ${Number(r.amount).toLocaleString()})` : "";
      const body = `${r.name}${amountStr} — ${kindLabel.toLowerCase()} on ${t.targetDate}.`
        + (t.kind === "cancellation_deadline" ? " Cancel before this date to avoid renewal." : (r.autopay ? " Autopay is on." : " Plan the payment."));
      const linkPath = `/app/recurring/${r.id}`;

      // In-app notifications
      await supabaseAdmin.from("notifications").insert(
        Array.from(recipientIds).map((uid) => ({
          tenant_id: r.tenant_id,
          user_id: uid,
          channel: "both",
          kind: `recurring_${t.kind}_${milestone}`,
          title,
          body,
          link_path: linkPath,
          payload: { recurring_id: r.id, target_date: t.targetDate, milestone },
        })),
      );

      // Email
      const { data: members } = await supabaseAdmin
        .from("tenant_users")
        .select("email")
        .eq("tenant_id", r.tenant_id)
        .in("user_id", Array.from(recipientIds));
      const emails = (members ?? []).map((m) => m.email).filter((e): e is string => !!e);
      if (emails.length > 0) {
        const origin = process.env.PUBLIC_APP_URL || APP_ORIGINS[APP_CODE];
        const { loginLinkEmail } = await import("@/lib/email.server");
        const tpl = loginLinkEmail({
          loginUrl: `${origin.replace(/\/$/, "")}${linkPath}`,
          subject: `[${APP_LABEL_BY_APP[APP_CODE]}] ${title}`,
        });
        try {
          await sendEmail({ to: emails, subject: tpl.subject, html: tpl.html });
        } catch (e: any) {
          errors.push(String(e?.message ?? e));
        }
      }

      queued++;
    }
  }

  return { processed: rows?.length ?? 0, queued, skipped, errors };
}

