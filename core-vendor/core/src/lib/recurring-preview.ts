// Client-side occurrence date preview — mirrors the server's buildOccurrenceDates.
// Used only for the form preview panel; the server is still the source of truth.

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
function advance(iso: string, frequency: string, dueDay: number | null): string {
  switch (frequency) {
    case "weekly": return addDays(iso, 7);
    case "biweekly": return addDays(iso, 14);
    case "semi_monthly": {
      const d = new Date(iso + "T00:00:00Z");
      const day = d.getUTCDate();
      if (day < 15) d.setUTCDate(15);
      else d.setUTCMonth(d.getUTCMonth() + 1, 1);
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

function normalizeAnchor(iso: string, frequency: string): string {
  if (frequency !== "semi_monthly") return iso;
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  if (day === 1 || day === 15) return iso;
  if (day < 15) d.setUTCDate(15);
  else d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return d.toISOString().slice(0, 10);
}

export function previewOccurrenceDates(opts: {
  frequency: string;
  start_date: string | null;
  next_date: string | null;
  end_date: string | null;
  due_day: number | null;
  count?: number; // default 6
}): string[] {
  const { frequency, start_date, next_date, end_date, due_day } = opts;
  const count = opts.count ?? 6;
  if (!frequency || frequency === "one_time" || frequency === "irregular" || frequency === "custom") {
    return next_date ? [next_date] : start_date ? [start_date] : [];
  }
  // Anchor at start_date (true series origin) to match the server's buildOccurrenceDates.
  const rawAnchor = start_date || next_date;
  if (!rawAnchor) return [];
  const anchor = normalizeAnchor(rawAnchor, frequency);
  const out: string[] = [];
  let cur = anchor;
  let safety = 0;
  while (out.length < count && safety++ < 200) {
    if (end_date && cur > end_date) break;
    out.push(cur);
    cur = advance(cur, frequency, due_day);
  }
  return out;
}
