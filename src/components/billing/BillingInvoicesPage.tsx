import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, Eye, ExternalLink, FileText, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency ?? "usd").toUpperCase(),
  }).format((cents ?? 0) / 100);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    open: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    failed: "bg-destructive/15 text-destructive",
    void: "bg-muted text-muted-foreground",
    refunded: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    draft: "bg-muted text-muted-foreground",
  };
  return `text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
    m[s] ?? "bg-muted text-muted-foreground"
  }`;
}

export function BillingInvoicesPage() {
  const { t } = useTranslation();
  const { useAuth, ui, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } = ui as any;
  const qc = useQueryClient();

  const { data: perm } = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing-invoices", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.listBillingInvoices({ tenant_id: currentTenantId!, limit: 100 }),
  });

  const seedM = useMutation({
    mutationFn: () => fns.seedSampleBillingInvoices({ tenant_id: currentTenantId! }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["billing-invoices", currentTenantId] });
      toast.success(
        r?.skipped
          ? t("billing.seed_skipped", "Sample invoices already exist.")
          : t("billing.seed_done", "Sample invoices created."),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryM = useMutation({
    mutationFn: (id: string) => fns.retryInvoicePayment({ tenant_id: currentTenantId!, id }),
    onSuccess: () =>
      toast.info(t("billing.stripe_coming_later", "Stripe integration coming later.")),
    onError: (e: Error) => toast.error(e.message),
  });

  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  const rows = data ?? [];
  const canManage = !!perm?.can_manage;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">
            {t("billing.invoices_title", "Invoices & Receipts")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(
              "billing.invoices_desc",
              "Once Stripe is connected, real invoices will appear here. For now the list shows local mock data.",
            )}
          </p>
        </div>
        {canManage && rows.length === 0 && (
          <Button size="sm" variant="outline" onClick={() => seedM.mutate()} disabled={seedM.isPending}>
            <Sparkles className="h-3.5 w-3.5" />
            {t("billing.seed_invoices", "Create sample invoices")}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg bg-card p-10 text-center text-sm text-muted-foreground">
          {t(
            "billing.no_invoices",
            "No invoices yet. Invoices will appear here once Stripe is connected.",
          )}
        </div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">{t("billing.invoice_date", "Date")}</th>
                <th className="px-3 py-2">{t("billing.invoice_no", "Invoice #")}</th>
                <th className="px-3 py-2">{t("billing.app", "App")}</th>
                <th className="px-3 py-2">{t("billing.period", "Billing period")}</th>
                <th className="px-3 py-2 text-right">{t("billing.amount_due", "Amount due")}</th>
                <th className="px-3 py-2 text-right">{t("billing.amount_paid", "Amount paid")}</th>
                <th className="px-3 py-2">{t("billing.status", "Status")}</th>
                <th className="px-3 py-2 text-right">{t("billing.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const due = Math.max(0, (r.amount_cents ?? 0) - (r.amount_paid_cents ?? 0));
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{fmtDate(r.issued_at)}</td>
                    <td className="px-3 py-2 font-mono">{r.number}</td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{r.app_code ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {r.period_start && r.period_end
                        ? `${fmtDate(r.period_start)} – ${fmtDate(r.period_end)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{fmtMoney(due, r.currency)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.amount_paid_cents, r.currency)}</td>
                    <td className="px-3 py-2"><span className={statusClass(r.status)}>{r.status}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setOpenId(r.id)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted"
                          title={t("billing.view_invoice", "View invoice")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground cursor-not-allowed"
                          title={t("billing.download_disabled", "Available after Stripe is connected")}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        {(r.status === "open" || r.status === "failed") && (
                          <button
                            disabled={!canManage || retryM.isPending}
                            onClick={() => {
                              if (!canManage) return;
                              retryM.mutate(r.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground cursor-not-allowed"
                            title={t("billing.stripe_coming_later", "Stripe integration coming later.")}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceDetailDialog
        invoiceId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function InvoiceDetailDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { useAuth, ui, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } = ui as any;
  const { data, isLoading } = useQuery({
    queryKey: ["billing-invoice", invoiceId],
    enabled: !!invoiceId && !!currentTenantId,
    queryFn: () => fns.getBillingInvoice({ tenant_id: currentTenantId!, id: invoiceId! }),
  });

  return (
    <Dialog open={!!invoiceId} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("billing.invoice_detail", "Invoice detail")}
          </DialogTitle>
          <DialogDescription>
            {t("billing.local_preview_note", "Local preview — hosted Stripe pages will appear here once connected.")}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.invoice_no", "Invoice #")}</span><span className="font-mono">{data.number}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.app", "App")}</span><span className="capitalize">{data.app_code ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.issued", "Issued")}</span><span>{fmtDate(data.issued_at)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.due", "Due")}</span><span>{fmtDate(data.due_at)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.period", "Billing period")}</span><span>{data.period_start && data.period_end ? `${fmtDate(data.period_start)} – ${fmtDate(data.period_end)}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.status", "Status")}</span><span className={statusClass(data.status)}>{data.status}</span></div>
            <div className="border-t pt-3 space-y-1">
              {data.description && (
                <div className="text-muted-foreground text-xs">{data.description}</div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.amount_total", "Total")}</span><span>{fmtMoney(data.amount_cents, data.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("billing.amount_paid", "Amount paid")}</span><span>{fmtMoney(data.amount_paid_cents ?? 0, data.currency)}</span></div>
              <div className="flex justify-between font-medium"><span>{t("billing.amount_due", "Amount due")}</span><span>{fmtMoney(Math.max(0, (data.amount_cents ?? 0) - (data.amount_paid_cents ?? 0)), data.currency)}</span></div>
            </div>
            <div className="border-t pt-3 space-y-2">
              <Button variant="outline" size="sm" disabled className="w-full justify-start cursor-not-allowed">
                <ExternalLink className="h-3.5 w-3.5" />
                {t("billing.hosted_invoice_placeholder", "Open hosted invoice — Coming Soon")}
              </Button>
              <Button variant="outline" size="sm" disabled className="w-full justify-start cursor-not-allowed">
                <Download className="h-3.5 w-3.5" />
                {t("billing.download_pdf_placeholder", "Download PDF — Coming Soon")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
