import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCashFlowForecast } from "@/lib/recurring-v2.functions";
import { fmtDate, fmtMoney } from "@/lib/format";


export const Route = createFileRoute("/app/cashflow")({ component: Page });

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function todayPlus(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return iso(d);
}

type PresetKey = "this_week" | "next_week" | "this_month" | "next_month" | "this_quarter" | "next_quarter" | "this_year" | "next_year";
type Granularity = "daily" | "monthly" | "quarterly" | "yearly";

type Bucket = { key: string; label: string; dates: string[]; money_in: number; money_out: number; net: number; running: number };

function bucketize(rows: any[], g: Granularity): Bucket[] {
  if (g === "daily") {
    return rows.map((r) => ({
      key: r.date,
      label: (() => { const [, m, d] = r.date.split("-"); return `${Number(m)}/${Number(d)}`; })(),
      dates: [r.date],
      money_in: Number(r.money_in ?? 0),
      money_out: Number(r.money_out ?? 0),
      net: Number(r.net ?? 0),
      running: Number(r.running ?? 0),
    }));
  }
  const keyFn = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    if (g === "monthly") return { key: `${y}-${String(m).padStart(2, "0")}`, label: `${y}-${String(m).padStart(2, "0")}` };
    if (g === "quarterly") { const q = Math.floor((m - 1) / 3) + 1; return { key: `${y}-Q${q}`, label: `${y} Q${q}` }; }
    return { key: `${y}`, label: `${y}` };
  };
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const { key, label } = keyFn(r.date);
    const b = map.get(key) ?? { key, label, dates: [], money_in: 0, money_out: 0, net: 0, running: 0 };
    b.dates.push(r.date);
    b.money_in += Number(r.money_in ?? 0);
    b.money_out += Number(r.money_out ?? 0);
    b.net += Number(r.net ?? 0);
    b.running = Number(r.running ?? 0); // last of bucket
    map.set(key, b);
  }
  return Array.from(map.values());
}

function presetRange(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = now.getDay(); // 0=Sun
  // Week: Monday-start
  const mondayOffset = (day + 6) % 7;
  const monThis = new Date(y, m, d - mondayOffset);
  const sunThis = new Date(y, m, d - mondayOffset + 6);
  const monNext = new Date(y, m, d - mondayOffset + 7);
  const sunNext = new Date(y, m, d - mondayOffset + 13);
  const qStart = Math.floor(m / 3) * 3;
  switch (key) {
    case "this_week": return { from: iso(monThis), to: iso(sunThis) };
    case "next_week": return { from: iso(monNext), to: iso(sunNext) };
    case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "next_month": return { from: iso(new Date(y, m + 1, 1)), to: iso(new Date(y, m + 2, 0)) };
    case "this_quarter": return { from: iso(new Date(y, qStart, 1)), to: iso(new Date(y, qStart + 3, 0)) };
    case "next_quarter": return { from: iso(new Date(y, qStart + 3, 1)), to: iso(new Date(y, qStart + 6, 0)) };
    case "this_year": return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case "next_year": return { from: iso(new Date(y + 1, 0, 1)), to: iso(new Date(y + 1, 11, 31)) };
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_week", label: "This week" },
  { key: "next_week", label: "Next week" },
  { key: "this_month", label: "This month" },
  { key: "next_month", label: "Next month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "next_quarter", label: "Next quarter" },
  { key: "this_year", label: "This year" },
  { key: "next_year", label: "Next year" },
];


function Page() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const fn = useServerFn(getCashFlowForecast);
  const [fromDate, setFromDate] = useState(todayPlus(-7));
  const [toDate, setToDate] = useState(todayPlus(90));
  const [opening, setOpening] = useState(0);
  const [incForecast, setIncForecast] = useState(true);
  const [incCommitted, setIncCommitted] = useState(true);
  const [incActuals, setIncActuals] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const toggle = (d: string) => setOpen((s) => ({ ...s, [d]: !s[d] }));

  const q = useQuery({
    queryKey: ["cashflow", currentTenantId, fromDate, toDate, opening, incForecast, incCommitted, incActuals],
    enabled: !!currentTenantId,
    queryFn: () => fn({ data: {
      tenant_id: currentTenantId!,
      from_date: fromDate, to_date: toDate, opening_balance: opening,
      include_forecast: incForecast, include_committed: incCommitted, include_actuals: incActuals,
    } }),
  });

  const data = q.data as any;

  const onBarClick = (dates: string[]) => {
    setOpen((s) => {
      const next = { ...s };
      for (const d of dates) next[d] = true;
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById(`cf-row-${dates[0]}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  return (
    <div className="space-y-6">
      <Link to="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back", "Back")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{t("cashflow.title", "Cash Flow Forecast")}</h1>
        <p className="text-sm text-muted-foreground">{t("cashflow.desc", "Forecast cash inflows and outflows using planned transactions.")}</p>
      </div>

      <div className="flex gap-3 flex-wrap items-end border rounded p-3 bg-card">
        <div>
          <label className="text-xs text-muted-foreground block">{t("cashflow.period", "Period")}</label>
          <Select
            value={PRESETS.find((p) => {
              const r = presetRange(p.key);
              return r.from === fromDate && r.to === toDate;
            })?.key ?? ""}
            onValueChange={(v) => {
              const r = presetRange(v as PresetKey);
              setFromDate(r.from); setToDate(r.to);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("cashflow.custom", "Custom")} />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {t(`cashflow.preset.${p.key}`, p.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block">{t("cashflow.from", "From")}</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block">{t("cashflow.to", "To")}</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block">{t("cashflow.opening_balance", "Opening Balance")}</label>
          <Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value))} className="w-32" />
        </div>

        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={incForecast} onChange={(e) => setIncForecast(e.target.checked)} /> Forecast</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={incCommitted} onChange={(e) => setIncCommitted(e.target.checked)} /> Committed</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={incActuals} onChange={(e) => setIncActuals(e.target.checked)} /> Actuals</label>
        <Button size="sm" onClick={() => q.refetch()}>{t("common.refresh", "Refresh")}</Button>
      </div>

      {q.isLoading && <div className="text-muted-foreground">{t("common.loading")}</div>}
      {q.error && <div className="text-destructive text-sm">{String((q.error as any).message)}</div>}

      {data && (
        <>
          {data.overdue && (data.overdue.pay_count > 0 || data.overdue.collect_count > 0) && (
            <OverdueBucket overdue={data.overdue} t={t} />
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t("cashflow.money_in", "Money In")} value={fmtMoney(data.totals.money_in)} color="text-emerald-700" />
            <Stat label={t("cashflow.money_out", "Money Out")} value={fmtMoney(data.totals.money_out)} color="text-rose-700" />
            <Stat label={t("cashflow.net", "Net")} value={fmtMoney(data.totals.net)} />
            <Stat label={t("cashflow.ending_balance", "Ending Balance")} value={fmtMoney(data.ending_balance)} />
          </div>

          {(data.rows as any[])?.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">{t("cashflow.granularity", "Chart granularity")}</label>
                <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                  <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("cashflow.gran.daily", "Daily")}</SelectItem>
                    <SelectItem value="monthly">{t("cashflow.gran.monthly", "Monthly")}</SelectItem>
                    <SelectItem value="quarterly">{t("cashflow.gran.quarterly", "Quarterly")}</SelectItem>
                    <SelectItem value="yearly">{t("cashflow.gran.yearly", "Yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <BarsChart buckets={bucketize(data.rows as any[], granularity)} t={t} onBarClick={onBarClick} />
            </>
          )}

          <CashflowTable rows={data.rows as any[]} t={t} open={open} toggle={toggle} />
        </>
      )}
    </div>
  );
}

function CashflowTable({ rows, t, open, toggle }: { rows: any[]; t: any; open: Record<string, boolean>; toggle: (d: string) => void }) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 w-6"></th>
            <th className="px-3 py-2">{t("cashflow.date", "Date")}</th>
            <th className="px-3 py-2 text-right">{t("cashflow.money_in", "Money In")}</th>
            <th className="px-3 py-2 text-right">{t("cashflow.money_out", "Money Out")}</th>
            <th className="px-3 py-2 text-right">{t("cashflow.net", "Net")}</th>
            <th className="px-3 py-2 text-right">{t("cashflow.running", "Running")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("cashflow.empty", "No occurrences in range.")}</td></tr>
          )}
          {rows.map((r) => {
            const isOpen = !!open[r.date];
            return (
              <React.Fragment key={r.date}>
                <tr
                  id={`cf-row-${r.date}`}
                  className="border-t cursor-pointer hover:bg-muted/30 scroll-mt-24"
                  onClick={() => toggle(r.date)}
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-3 py-2">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-right num text-emerald-700">{r.money_in ? fmtMoney(r.money_in) : "—"}</td>
                  <td className="px-3 py-2 text-right num text-rose-700">{r.money_out ? fmtMoney(r.money_out) : "—"}</td>
                  <td className={`px-3 py-2 text-right num ${r.net < 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmtMoney(r.net)}</td>
                  <td className="px-3 py-2 text-right num font-medium">{fmtMoney(r.running)}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td></td>
                    <td colSpan={5} className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="text-left py-1 font-normal">{t("cashflow.item", "Item")}</th>
                            <th className="text-left py-1 font-normal">{t("cashflow.stage", "Stage")}</th>
                            <th className="text-left py-1 font-normal">{t("cashflow.direction", "Direction")}</th>
                            <th className="text-right py-1 font-normal">{t("cashflow.amount", "Amount")}</th>
                            <th className="py-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.items as any[]).map((it, i) => {
                            const name = it.recurring_transactions?.name ?? "—";
                            const amt = Number(it.actual_amount ?? it.forecast_amount ?? 0);
                            return (
                              <tr key={i} className="border-t border-border/40">
                                <td className="py-1">{name}</td>
                                <td className="py-1">{it.stage}</td>
                                <td className="py-1">{it.direction === "money_in" ? t("cashflow.money_in", "Money In") : t("cashflow.money_out", "Money Out")}</td>
                                <td className={`py-1 text-right num ${it.direction === "money_in" ? "text-emerald-700" : "text-rose-700"}`}>{fmtMoney(amt)}</td>
                                <td className="py-1 text-right">
                                  {it.recurring_id && (
                                    <Link
                                      to="/app/recurring/$id"
                                      params={{ id: it.recurring_id }}
                                      className="text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {t("common.view", "View")}
                                    </Link>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function BarsChart({ buckets, t, onBarClick }: { buckets: Bucket[]; t: any; onBarClick: (dates: string[]) => void }) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.money_in, b.money_out)));
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium">{t("cashflow.chart_title", "Money in vs out")}</h2>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm" /> {t("cashflow.money_in", "Money In")}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 bg-rose-500 rounded-sm" /> {t("cashflow.money_out", "Money Out")}</span>
        </div>
      </div>
      <TooltipProvider delayDuration={100}>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 h-40 min-w-full" style={{ minWidth: `${buckets.length * 40}px` }}>
            {buckets.map((b) => {
              const inH = (b.money_in / max) * 100;
              const outH = (b.money_out / max) * 100;
              return (
                <Tooltip key={b.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onBarClick(b.dates)}
                      className="flex flex-col items-center gap-1 flex-1 min-w-[32px] group"
                    >
                      <div className="flex items-end gap-0.5 h-32 w-full justify-center">
                        <div className="w-3 bg-emerald-500 rounded-t group-hover:bg-emerald-600 transition-colors" style={{ height: `${inH}%` }} />
                        <div className="w-3 bg-rose-500 rounded-t group-hover:bg-rose-600 transition-colors" style={{ height: `${outH}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{b.label}</div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <div className="font-medium mb-1">{b.label}</div>
                    <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />{t("cashflow.money_in", "Money In")}</span>
                      <span className="text-right tabular-nums">{fmtMoney(b.money_in)}</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm bg-rose-500" />{t("cashflow.money_out", "Money Out")}</span>
                      <span className="text-right tabular-nums">{fmtMoney(b.money_out)}</span>
                      <span className="border-t pt-0.5 mt-0.5 font-medium">{t("cashflow.net", "Net")}</span>
                      <span className="border-t pt-0.5 mt-0.5 text-right tabular-nums font-medium">{fmtMoney(b.net)}</span>
                      <span className="font-medium">{t("cashflow.running", "Running")}</span>
                      <span className="text-right tabular-nums font-medium">{fmtMoney(b.running)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}


function OverdueBucket({ overdue, t }: { overdue: any; t: any }) {
  const [expanded, setExpanded] = useState<"pay" | "collect" | null>(null);
  const payItems = (overdue.items as any[]).filter((o) => o.direction === "money_out");
  const collectItems = (overdue.items as any[]).filter((o) => o.direction === "money_in");

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        <button
          type="button"
          onClick={() => setExpanded((s) => (s === "pay" ? null : "pay"))}
          className="text-left p-4 bg-rose-500/5 hover:bg-rose-500/10 transition-colors"
          disabled={overdue.pay_count === 0}
        >
          <div className="text-xs uppercase tracking-wide text-rose-700 font-medium">
            {t("cashflow.overdue_pay", "Overdue · You need to pay")}
          </div>
          <div className="text-2xl font-semibold text-rose-700 mt-1 num">{fmtMoney(overdue.pay_total)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("cashflow.overdue_count", "{{count}} item(s)", { count: overdue.pay_count })}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((s) => (s === "collect" ? null : "collect"))}
          className="text-left p-4 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
          disabled={overdue.collect_count === 0}
        >
          <div className="text-xs uppercase tracking-wide text-blue-700 font-medium">
            {t("cashflow.overdue_collect", "Overdue · You need to collect")}
          </div>
          <div className="text-2xl font-semibold text-blue-700 mt-1 num">{fmtMoney(overdue.collect_total)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {t("cashflow.overdue_count", "{{count}} item(s)", { count: overdue.collect_count })}
          </div>
        </button>
      </div>
      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-1 font-normal">{t("recurring.name", "Name")}</th>
                <th className="text-left py-1 font-normal">{t("recurring.priority", "Priority")}</th>
                <th className="text-left py-1 font-normal">{t("cashflow.days_overdue", "Days overdue")}</th>
                <th className="text-right py-1 font-normal">{t("cashflow.amount", "Amount")}</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {(expanded === "pay" ? payItems : collectItems).map((o: any) => (
                <tr key={o.id} className="border-t border-border/40">
                  <td className="py-1.5">{o.recurring_transactions?.name ?? "—"}</td>
                  <td className="py-1.5">{o.priority}</td>
                  <td className="py-1.5">{o.days_overdue}</td>
                  <td className="py-1.5 text-right num">{fmtMoney(o.forecast_amount)}</td>
                  <td className="py-1.5 text-right">
                    <Link to="/app/recurring/$id" params={{ id: o.recurring_id }} className="text-primary hover:underline">
                      {t("common.view", "View")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border rounded p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${color ?? ""}`}>{value}</div>
    </div>
  );
}
