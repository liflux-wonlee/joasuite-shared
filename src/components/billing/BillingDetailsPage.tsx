import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { useJoaSuite } from "../../context";

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  wide?: boolean;
  type?: "text" | "email" | "textarea";
  maxLength?: number;
};

const SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Business",
    fields: [
      { key: "company_legal_name", label: "Legal business name", placeholder: "Acme Inc.", wide: true, maxLength: 200 },
      { key: "tax_id", label: "Tax ID / EIN", placeholder: "12-3456789", maxLength: 64 },
      { key: "billing_email", label: "Billing email", placeholder: "billing@example.com", type: "email" },
      { key: "billing_phone", label: "Billing phone", placeholder: "+1 555 555 5555", maxLength: 40 },
    ],
  },
  {
    title: "Billing address",
    fields: [
      { key: "address_line1", label: "Address line 1", wide: true, maxLength: 200 },
      { key: "address_line2", label: "Address line 2", wide: true, maxLength: 200 },
      { key: "city", label: "City", maxLength: 100 },
      { key: "state", label: "State / Region", maxLength: 100 },
      { key: "postal_code", label: "ZIP / Postal code", maxLength: 20 },
      { key: "country", label: "Country (ISO 2)", placeholder: "US", maxLength: 2 },
    ],
  },
  {
    title: "Billing contact",
    fields: [
      { key: "billing_contact_name", label: "Billing contact name", maxLength: 120 },
      { key: "billing_contact_email", label: "Billing contact email", type: "email" },
    ],
  },
  {
    title: "Invoice memo",
    fields: [
      { key: "invoice_memo", label: "Invoice memo", placeholder: "Appears on every invoice (PO #, references, notes)", wide: true, type: "textarea", maxLength: 1000 },
    ],
  },
];

const ALL_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

export function BillingDetailsPage() {
  const { t } = useTranslation();
  const { useAuth, ui, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const { Button, Input, Label, Textarea } = ui as any;
  const qc = useQueryClient();

  const overviewQ = useQuery({
    queryKey: ["billing-overview", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.getBillingOverview({ tenant_id: currentTenantId! }),
  });
  const permQ = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });
  const canManage = !!permQ.data?.can_manage;

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    const c = (overviewQ.data?.customer ?? {}) as Record<string, unknown>;
    const next: Record<string, string> = {};
    ALL_KEYS.forEach((k) => (next[k] = (c[k] as string | null) ?? ""));
    setForm(next);
  }, [overviewQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | null> & { tenant_id: string } = { tenant_id: currentTenantId! };
      ALL_KEYS.forEach((k) => {
        const v = (form[k] ?? "").trim();
        (payload as Record<string, string | null>)[k] = v ? v : null;
      });
      if (payload.country) payload.country = (payload.country as string).toUpperCase();
      return fns.updateBillingCustomer(payload);
    },
    onSuccess: () => {
      toast.success(t("billing.details_saved", "Billing information saved"));
      qc.invalidateQueries({ queryKey: ["billing-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (overviewQ.isLoading) return <div className="text-muted-foreground">{t("common.loading", "Loading...")}</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          {t(
            "billing.details.stripe_note",
            "Stored in your JoaSuite organization. These fields will be synced to your Stripe customer record once Stripe integration is enabled.",
          )}
        </span>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="border rounded-lg bg-card p-5">
          <h3 className="font-semibold mb-3">{t(`billing.details.section.${section.title.toLowerCase().replace(/\s+/g, "_")}`, section.title)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.fields.map((f) => (
              <div key={f.key} className={f.wide ? "md:col-span-2" : ""}>
                <Label htmlFor={f.key}>{t(`billing.field.${f.key}`, f.label)}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.key}
                    value={form[f.key] ?? ""}
                    onChange={(e: any) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    rows={3}
                    disabled={!canManage}
                  />
                ) : (
                  <Input
                    id={f.key}
                    type={f.type ?? "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e: any) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    disabled={!canManage}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </Button>
        </div>
      )}
    </div>
  );
}
