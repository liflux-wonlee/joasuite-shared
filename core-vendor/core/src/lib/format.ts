export const STATUS_VARIANT: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-orange-100 text-orange-800",
  finance_review: "bg-info/15 text-info",
  pending: "bg-warning/15 text-warning-foreground",
  pending_reason: "bg-warning/15 text-warning-foreground",
  pending_vendor_clarification: "bg-warning/15 text-warning-foreground",
  finance_approved: "bg-primary/15 text-primary",
  approval_pending: "bg-warning/15 text-warning-foreground",
  partially_approved: "bg-warning/15 text-warning-foreground",
  pending_by_approver: "bg-warning/15 text-warning-foreground",
  rejected: "bg-destructive/15 text-destructive",
  approved: "bg-emerald-600 text-white",
  fully_approved: "bg-emerald-600 text-white",
  payment_processing: "bg-info/15 text-info",
  paid: "bg-blue-600 text-white",
  partially_paid: "bg-blue-200 text-blue-900",
  recorded: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
  void: "bg-muted text-muted-foreground line-through",
};

export function statusClass(status: string) {
  return `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
    STATUS_VARIANT[status] ?? "bg-muted text-muted-foreground"
  }`;
}

export function fmtMoney(n: number | string | null | undefined) {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

import { getDisplayTimezone } from "./timezone";

/**
 * Format a date-only value (YYYY-MM-DD or Date). Bare YYYY-MM-DD strings
 * are treated as calendar dates and formatted without any timezone shift.
 * Full timestamps are converted into the current display timezone.
 */
export function fmtDate(d: string | Date | null | undefined, tz?: string) {
  if (!d) return "";
  const zone = tz ?? getDisplayTimezone();
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    // Calendar date — render as-is with no tz shift.
    const [y, m, day] = d.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "short", day: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, day)));
  }
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: zone,
  }).format(dt);
}

export function fmtDateTime(d: string | Date | null | undefined, tz?: string) {
  if (!d) return "";
  const zone = tz ?? getDisplayTimezone();
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: zone, timeZoneName: "short",
  }).format(dt);
}

export type StatusFlag = {
  key: string;
  i18nKey: string;
  className: string;
};

/**
 * Compute additional context-flag badges to display alongside the main status.
 * Returns extra chips like "Approver assigned", "Approver responded", or "Approver not assigned".
 */
const TERMINAL_OR_POST_APPROVAL = new Set([
  "fully_approved",
  "payment_processing",
  "paid",
  "partially_paid",
  "recorded",
  "rejected",
  "cancelled",
  "void",
]);

export function computeStatusFlags(
  prStatus: string | null | undefined,
  approvals: Array<{ status: string }> | null | undefined,
  approvalsCount?: number,
): StatusFlag[] {
  const flags: StatusFlag[] = [];
  const status = prStatus ?? "";
  // Suppress approver-related flags once the PR has progressed past the approval stage.
  if (TERMINAL_OR_POST_APPROVAL.has(status)) return flags;

  const list = approvals ?? [];
  const hasAny = approvalsCount !== undefined ? approvalsCount > 0 : list.length > 0;
  const hasDecision = list.some((a) => a.status === "approved" || a.status === "rejected");
  const allApproved = hasAny && list.every((a) => a.status === "approved");

  if (!hasAny && status !== "draft" && status !== "submitted") {
    flags.push({
      key: "approver_not_assigned",
      i18nKey: "status_flags.approver_not_assigned",
      className: "bg-indigo-600 text-white",
    });
  }
  if (hasAny && status !== "draft" && status !== "submitted") {
    flags.push({
      key: "approver_assigned",
      i18nKey: "status_flags.approver_assigned",
      className: "bg-primary/15 text-primary",
    });
  }
  if (hasDecision && !allApproved) {
    flags.push({
      key: "approver_responded",
      i18nKey: "status_flags.approver_responded",
      className: "bg-info/15 text-info",
    });
  }
  return flags;
}

export function flagClass(className: string) {
  return `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${className}`;
}

/** Convert "fully_approved" / "payment processing" → "Fully Approved" / "Payment Processing". */
export function titleCaseStatus(s: string | null | undefined) {
  if (!s) return "";
  return String(s)
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}


