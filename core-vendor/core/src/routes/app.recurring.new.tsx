import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RecurringForm } from "@/components/recurring/RecurringForm";
import { createRecurring } from "@/lib/recurring-v2.functions";

const FIELD_LABELS: Record<string, string> = {
  direction: "Direction (Money In / Money Out)",
  name: "Name",
  tenant_id: "Workspace",
  currency_code: "Currency",
  amount: "Amount",
  start_date: "Start date",
  next_date: "Next date",
  frequency: "Frequency",
  party_id: "Party (Vendor/Customer)",
};

function humanizeError(e: any): string {
  const raw = e?.message ?? e;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  // Try to parse Zod-style issue arrays.
  try {
    const match = text.match(/\[[\s\S]*\]/);
    const issues = match ? JSON.parse(match[0]) : null;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .map((iss: any) => {
          const path = Array.isArray(iss.path) ? iss.path.join(".") : String(iss.path ?? "");
          const label = FIELD_LABELS[path] ?? path ?? "Field";
          if (iss.code === "invalid_value" && Array.isArray(iss.values)) {
            return `${label}: please choose one of ${iss.values.join(", ")}.`;
          }
          if (iss.code === "invalid_type") {
            return `${label} is required.`;
          }
          return `${label}: ${iss.message ?? "invalid value"}`;
        })
        .join("\n");
    }
  } catch {
    // fall through
  }
  return typeof raw === "string" ? raw : "Could not save. Please check the form and try again.";
}

type Search = {
  name?: string;
  direction?: "money_in" | "money_out";
  party_id?: string;
  amount?: number;
  currency_code?: string;
  description?: string;
  from?: string; // source doc kind (pr|bill|expense) for traceability
  from_id?: string;
};

export const Route = createFileRoute("/app/recurring/new")({
  component: Page,
  validateSearch: (s: Record<string, unknown>): Search => ({
    name: typeof s.name === "string" ? s.name : undefined,
    direction: s.direction === "money_in" || s.direction === "money_out" ? s.direction : undefined,
    party_id: typeof s.party_id === "string" ? s.party_id : undefined,
    amount: typeof s.amount === "number" ? s.amount : s.amount ? Number(s.amount) : undefined,
    currency_code: typeof s.currency_code === "string" ? s.currency_code : undefined,
    description: typeof s.description === "string" ? s.description : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
    from_id: typeof s.from_id === "string" ? s.from_id : undefined,
  }),
});

function Page() {
  const { t } = useTranslation();
  const { currentTenantId } = useAuth();
  const nav = useNavigate();
  const search = useSearch({ from: "/app/recurring/new" }) as Search;
  const createFn = useServerFn(createRecurring);

  const create = useMutation({
    mutationFn: (v: any) => createFn({ data: { tenant_id: currentTenantId!, source_app: "joabooks", ...v, plan_lines: v.plan_lines ?? [] } }),
    onSuccess: (row: any) => {
      toast.success(t("recurring.pt_created", "Planned transaction created"));
      nav({ to: "/app/recurring/$id", params: { id: row.id } });
    },
    onError: (e: any) => toast.error(humanizeError(e)),
  });

  const initial = {
    name: search.name,
    direction: search.direction,
    party_id: search.party_id ?? null,
    amount: search.amount,
    currency_code: search.currency_code,
    description: search.description,
  };

  return (
    <div className="max-w-4xl">
      <Link to="/app/recurring" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("common.back", "Back")}
      </Link>
      <h1 className="text-2xl font-semibold mb-4">{t("recurring.new_planned_transaction", "New Planned Transaction")}</h1>
      {search.from && (
        <p className="text-xs text-muted-foreground mb-3">
          {t("recurring.prefilled_from", "Pre-filled from")}: {search.from}{search.from_id ? ` (${search.from_id.slice(0, 8)})` : ""}
        </p>
      )}
      <RecurringForm
        tenantId={currentTenantId!}
        initial={initial as any}
        submitting={create.isPending}
        submitLabel={t("common.create", "Create")}
        onSubmit={(v) => create.mutate(v)}
        onCancel={() => nav({ to: "/app/recurring" })}
      />
    </div>
  );
}
