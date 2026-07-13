import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Copy, Users, DollarSign, Lock, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

type Program = {
  code: string;
  slug: string;
  reward_type: string;
  reward_amount_cents: number;
  reward_currency: string;
  referee_discount_percent: number;
  referee_discount_months: number;
  credit_available_cents: number;
  credit_used_cents: number;
};

type Referral = {
  id: string;
  code: string;
  referee_email: string | null;
  referee_org_name: string | null;
  status: "pending" | "signed_up" | "subscribed" | "canceled";
  reward_amount_cents: number;
  reward_currency: string;
  signed_up_at: string | null;
  subscribed_at: string | null;
  created_at: string;
};

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function statusBadge(s: Referral["status"]) {
  const m: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    signed_up: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    subscribed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    canceled: "bg-muted text-muted-foreground",
  };
  return `text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${m[s]}`;
}

export function BillingReferralsPage() {
  const { t } = useTranslation();
  const { useAuth, fns } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");

  const { data: perm } = useQuery({
    queryKey: ["billing-perm", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.canManageBillingFn({ tenant_id: currentTenantId! }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["referral-program", currentTenantId],
    enabled: !!currentTenantId,
    queryFn: () => fns.getReferralProgram({ tenant_id: currentTenantId! }) as Promise<{ program: Program; referrals: Referral[] }>,
  });

  const program = data?.program;
  const referrals = data?.referrals ?? [];

  const link = useMemo(() => (program ? `https://joasuite.com/r/${program.code}` : ""), [program]);

  const pending = referrals.filter((r) => r.status === "pending").length;
  const confirmed = referrals.filter((r) => r.status === "subscribed").length;

  const addMut = useMutation({
    mutationFn: () => fns.addMockReferral({
      tenant_id: currentTenantId!,
      referee_email: email.trim(),
      referee_org_name: orgName.trim() || undefined,
      status: "pending",
    }),
    onSuccess: () => {
      toast.success(t("billing.referrals.added", "Referral recorded"));
      setEmail(""); setOrgName("");
      qc.invalidateQueries({ queryKey: ["referral-program", currentTenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const advanceMut = useMutation({
    mutationFn: (vars: { id: string; status: Referral["status"] }) =>
      fns.updateReferralStatus({ tenant_id: currentTenantId!, referral_id: vars.id, status: vars.status }),
    onSuccess: () => {
      toast.success(t("billing.referrals.updated", "Status updated"));
      qc.invalidateQueries({ queryKey: ["referral-program", currentTenantId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const canManage = !!perm?.can_manage;

  if (isLoading || !program) {
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  }

  const rewardLine = t(
    "billing.referrals.reward_line",
    "You receive {{amount}} billing credit when a referred organization becomes a paid customer.",
    { amount: fmt(program.reward_amount_cents, program.reward_currency) },
  );
  const refereeLine = t(
    "billing.referrals.referee_line",
    "The referred organization receives {{pct}}% off for the first {{months}} months.",
    { pct: program.referee_discount_percent, months: program.referee_discount_months },
  );

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{t("billing.referrals.stripe_note", "Referrals and billing credit are tracked locally for MVP. Real payouts and Stripe credit/coupon issuance will be connected in a future phase.")}</span>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="h-4 w-4" />} label={t("billing.referrals.pending", "Pending")} value={pending.toString()} />
        <Stat icon={<Gift className="h-4 w-4" />} label={t("billing.referrals.confirmed", "Confirmed")} value={confirmed.toString()} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label={t("billing.referrals.credit_available", "Credit available")} value={fmt(program.credit_available_cents, program.reward_currency)} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label={t("billing.referrals.credit_used", "Credit used")} value={fmt(program.credit_used_cents, program.reward_currency)} />
      </div>

      <div className="border rounded-lg bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{t("billing.referrals.share_title", "Share your referral link")}</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-1 mb-3">
          <div>{rewardLine}</div>
          <div>{refereeLine}</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("billing.referrals.your_code", "Your referral code")}</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={program.code} className="flex-1 border rounded-md px-3 py-2 text-sm font-mono bg-muted/30" />
              <button
                onClick={() => { navigator.clipboard.writeText(program.code); toast.success(t("billing.referrals.copied", "Copied")); }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("billing.referrals.your_link", "Your referral link")}</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={link} className="flex-1 border rounded-md px-3 py-2 text-sm font-mono bg-muted/30" />
              <button
                onClick={() => { navigator.clipboard.writeText(link); toast.success(t("billing.referrals.copied", "Copied")); }}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            disabled
            title={t("billing.stripe_pending", "Stripe integration coming later")}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-primary/40 text-primary-foreground cursor-not-allowed"
          >
            <Lock className="h-3.5 w-3.5" />
            {t("billing.referrals.withdraw", "Withdraw credit — Coming Soon")}
          </button>
        </div>
      </div>

      {canManage && (
        <div className="border rounded-lg bg-card p-5">
          <h3 className="font-semibold mb-2">{t("billing.referrals.add_mock", "Add a mock referral")}</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {t("billing.referrals.add_mock_desc", "For testing only — records a local referral entry. No real invite is sent.")}
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) addMut.mutate(); }}
            className="flex flex-wrap gap-2 max-w-3xl"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="referee@example.com"
              className="flex-1 min-w-[200px] border rounded-md px-3 py-2 text-sm bg-background"
              required
            />
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t("billing.referrals.org_name_ph", "Organization name (optional)")}
              className="flex-1 min-w-[200px] border rounded-md px-3 py-2 text-sm bg-background"
            />
            <button
              type="submit"
              disabled={addMut.isPending}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("billing.referrals.add", "Add")}
            </button>
          </form>
        </div>
      )}

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold">{t("billing.referrals.history", "Referral history")}</h3>
        </div>
        {referrals.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">{t("billing.referrals.none", "No referrals yet.")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">{t("billing.referrals.email", "Email")}</th>
                <th className="px-3 py-2">{t("billing.referrals.org", "Organization")}</th>
                <th className="px-3 py-2">{t("billing.status", "Status")}</th>
                <th className="px-3 py-2">{t("billing.referrals.signed_up", "Signed up")}</th>
                <th className="px-3 py-2">{t("billing.referrals.subscribed_at", "Subscribed")}</th>
                <th className="px-3 py-2 text-right">{t("billing.referrals.reward", "Reward")}</th>
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.referee_email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.referee_org_name ?? "—"}</td>
                  <td className="px-3 py-2"><span className={statusBadge(r.status)}>{r.status.replace("_", " ")}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.signed_up_at ? new Date(r.signed_up_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.subscribed_at ? new Date(r.subscribed_at).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-right">{fmt(r.reward_amount_cents, r.reward_currency)}</td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      {r.status === "pending" && (
                        <button onClick={() => advanceMut.mutate({ id: r.id, status: "signed_up" })} className="text-xs text-primary hover:underline">
                          {t("billing.referrals.mark_signed_up", "Mark signed up")}
                        </button>
                      )}
                      {r.status === "signed_up" && (
                        <button onClick={() => advanceMut.mutate({ id: r.id, status: "subscribed" })} className="text-xs text-primary hover:underline">
                          {t("billing.referrals.mark_subscribed", "Mark subscribed")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
