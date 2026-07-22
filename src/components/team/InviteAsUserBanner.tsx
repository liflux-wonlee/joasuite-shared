import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

export type InviteAsUserBannerProps = {
  tenantId: string;
  partyId: string;
  name: string | null | undefined;
  email: string | null | undefined;
  linkedUserId: string | null | undefined;
};

/**
 * Team Members are HR/directory records first — creating one never
 * auto-invites a login (some workers never need one). Inviting is a
 * separate, explicit admin action: it invites-or-links this person's
 * account and grants them the "employee" role for THIS app only, then
 * links parties.linked_user_id so future self-scoped views resolve them.
 *
 * Lives on TeamMemberView (the read-only detail page) rather than
 * TeamMemberForm — it's a standalone action, not a field being edited.
 */
export function InviteAsUserBanner({ tenantId, partyId, name, email, linkedUserId }: InviteAsUserBannerProps) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const { Button } = ui;
  const qc = useQueryClient();

  const invite = useMutation({
    mutationFn: () =>
      fns.inviteTenantUser({
        tenant_id: tenantId,
        email: (email ?? "").trim(),
        display_name: (name ?? "").trim(),
        portal: "internal",
        roles: ["employee"],
        party_id: partyId,
      }),
    onSuccess: () => {
      toast.success(t("team.invite_sent", "Invitation sent"));
      qc.invalidateQueries({ queryKey: ["team-member", tenantId, partyId] });
      qc.invalidateQueries({ queryKey: ["team-list", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border p-3 space-y-1.5">
      {linkedUserId ? (
        <p className="text-xs text-muted-foreground">
          {t("team.linked_to_user", "Linked to an app user account.")}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("team.not_linked", "This person doesn't have an app login yet. Not everyone needs one.")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 dark:hover:bg-blue-900"
            onClick={() => invite.mutate()}
            disabled={invite.isPending || !(email ?? "").trim() || !(name ?? "").trim()}
          >
            {invite.isPending
              ? t("team.inviting", "Inviting…")
              : t("team.invite_as_user", "Invite as user")}
          </Button>
        </>
      )}
    </div>
  );
}
