import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CreditCard, Landmark, AlertTriangle, Star, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

type PaymentStatus = "not_connected" | "card_on_file" | "ach_on_file" | "expired" | "failed";

function isExpired(pm: { exp_month: number; exp_year: number }) {
  const now = new Date();
  return pm.exp_year < now.getFullYear() || (pm.exp_year === now.getFullYear() && pm.exp_month < now.getMonth() + 1);
}

function computeStatus(rows: any[]): PaymentStatus {
  if (!rows.length) return "not_connected";
  const defaultPm = rows.find((r) => r.is_default) ?? rows[0];
  if (defaultPm.status === "failed") return "failed";
  if (isExpired(defaultPm)) return "expired";
  if (defaultPm.brand?.toLowerCase() === "ach") return "ach_on_file";
  return "card_on_file";
}

const STATUS_STYLES: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_connected: { label: "billing.pm_status.not_connected", variant: "outline" },
  card_on_file: { label: "billing.pm_status.card_on_file", variant: "default" },
  ach_on_file: { label: "billing.pm_status.ach_on_file", variant: "secondary" },
  expired: { label: "billing.pm_status.expired", variant: "destructive" },
  failed: { label: "billing.pm_status.failed", variant: "destructive" },
};

export function BillingPaymentMethodsPage() {
  const { t } = useTranslation();
  const { useAuth, ui, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Button, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } = ui as any;
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ["billing-payment-methods", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.listBillingPaymentMethods({ tenant_id: currentTenantId! }),
  });
  const permQ = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });
  const canManage = !!permQ.data?.can_manage;

  const rows = listQ.data ?? [];
  const status = computeStatus(rows);
  const style = STATUS_STYLES[status];

  const add = useMutation({
    mutationFn: async (opts: { brand: string; last4: string; exp_month: number; exp_year: number }) =>
      fns.addMockPaymentMethod({
        tenant_id: currentTenantId!,
        brand: opts.brand,
        last4: opts.last4,
        exp_month: opts.exp_month,
        exp_year: opts.exp_year,
        make_default: true,
      }),
    onSuccess: () => {
      toast.success(t("billing.pm_added", "Payment method added (simulated)"));
      qc.invalidateQueries({ queryKey: ["billing-payment-methods"] });
      qc.invalidateQueries({ queryKey: ["billing-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDef = useMutation({
    mutationFn: async (id: string) => fns.setDefaultPaymentMethod({ tenant_id: currentTenantId!, id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-payment-methods"] });
      qc.invalidateQueries({ queryKey: ["billing-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => fns.removePaymentMethod({ tenant_id: currentTenantId!, id }),
    onSuccess: () => {
      toast.success(t("billing.pm_removed", "Payment method removed"));
      qc.invalidateQueries({ queryKey: ["billing-payment-methods"] });
      qc.invalidateQueries({ queryKey: ["billing-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const expiredYear = now.getFullYear() - 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{t("billing.payment_method_title", "Payment Method")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("billing.payment_method_subtitle", "Manage how your organization pays for JoaSuite subscriptions.")}
          </p>
        </div>
        <Button disabled variant="outline" className="gap-2">
          <ExternalLink className="h-4 w-4" />
          {t("billing.open_stripe_portal", "Open Stripe Billing Portal - Coming Soon")}
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              {status === "ach_on_file" ? <Landmark className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("billing.current_status", "Current status")}</div>
              <Badge variant={style.variant}>{t(style.label)}</Badge>
            </div>
          </div>
          {canManage && status === "not_connected" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  {t("billing.simulate_add_mock", "Simulate add mock method")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    add.mutate({ brand: "Visa", last4: "4242", exp_month: now.getMonth() + 1, exp_year: now.getFullYear() + 3 })
                  }
                  disabled={add.isPending}
                >
                  {t("billing.simulate.visa_4242", "Visa ending 4242")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    add.mutate({ brand: "Mastercard", last4: "5555", exp_month: now.getMonth() + 1, exp_year: now.getFullYear() + 2 })
                  }
                  disabled={add.isPending}
                >
                  {t("billing.simulate.mastercard_5555", "Mastercard ending 5555")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    add.mutate({ brand: "ACH", last4: "6789", exp_month: 1, exp_year: 2099 })
                  }
                  disabled={add.isPending}
                >
                  {t("billing.simulate.ach_6789", "ACH ending 6789")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    add.mutate({ brand: "Visa", last4: "0001", exp_month: 1, exp_year: expiredYear })
                  }
                  disabled={add.isPending}
                >
                  {t("billing.simulate.expired_card", "Expired Visa ending 0001")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center space-y-2">
            <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm font-medium">
              {t("billing.pm_placeholder_title", "Payment method will be managed through Stripe in a future phase.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("billing.pm_placeholder_desc", "Until then, this page displays mock data only. No real card or bank details are collected.")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border divide-y">
            {rows.map((pm: any) => {
              const expired = isExpired(pm);
              return (
                <div key={pm.id} className="p-4 flex items-center gap-3">
                  <div className="rounded-full bg-muted p-2 text-muted-foreground">
                    {pm.brand?.toLowerCase() === "ach" ? <Landmark className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {t("billing.pm_display", "{{brand}} ending {{last4}}", { brand: pm.brand, last4: pm.last4 })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pm.brand?.toLowerCase() === "ach"
                        ? t("billing.ach_account", "Bank account")
                        : t("billing.expires", "Expires") + " " + String(pm.exp_month).padStart(2, "0") + "/" + pm.exp_year}
                      {expired && (
                        <span className="ml-2 inline-flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {t("billing.expired", "Expired")}
                        </span>
                      )}
                    </div>
                  </div>
                  {pm.is_default && (
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      {t("billing.default", "Default")}
                    </span>
                  )}
                  {canManage && !pm.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDef.mutate(pm.id)}
                      title={t("billing.set_default", "Set as default")}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove.mutate(pm.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {t(
            "billing.pm_stripe_note",
            "Stripe integration coming later. Actions on this page update local mock data only and never store real card or bank information.",
          )}
        </span>
      </div>
    </div>
  );
}
