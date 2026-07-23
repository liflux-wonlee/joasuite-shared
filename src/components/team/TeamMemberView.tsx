import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import { useJoaSuite } from "../../context";
import { FieldGroup, FieldRow } from "../FieldGroup";
import { InviteAsUserBanner } from "./InviteAsUserBanner";

export type TeamMemberViewProps = {
  tenantId: string;
  partyId: string;
  /** Called when the top-right Edit button is clicked — the host app owns navigation to its own edit route. */
  onEdit?: () => void;
};

/**
 * Read-only Team Member detail — the default landing page when opening a
 * team member (see TeamListPage). Editing happens on a separate page,
 * reached via the Edit button here, not inline.
 */
export function TeamMemberView({ tenantId, partyId, onEdit }: TeamMemberViewProps) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const { Button } = ui;

  const entryQ = useQuery({
    queryKey: ["team-member", tenantId, partyId],
    enabled: !!tenantId && !!partyId,
    queryFn: () => fns.getTeamMember({ tenant_id: tenantId, party_id: partyId }),
  });
  const e: any = entryQ.data;

  if (entryQ.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (!e) {
    return <div className="text-sm text-muted-foreground">{t("team.not_found", "Team member not found.")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold">{e.name_en || "—"}</div>
          {e.contact_email && <div className="text-sm text-muted-foreground">{e.contact_email}</div>}
        </div>
        {onEdit && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            {t("common.edit", "Edit")}
          </Button>
        )}
      </div>

      <InviteAsUserBanner
        tenantId={tenantId}
        partyId={partyId}
        name={e.name_en}
        email={e.contact_email}
        linkedUserId={e.linked_user_id}
      />

      <FieldGroup title={t("team.group_contact", "Contact")}>
        <FieldRow label={t("team.contact_phone", "Phone")} value={e.contact_phone} />
      </FieldGroup>

      <FieldGroup title={t("team.group_organization", "Organization")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow label={t("team.department", "Department")} value={e.department} />
          <FieldRow label={t("team.position", "Position")} value={e.position} />
        </div>
      </FieldGroup>

      <FieldGroup title={t("team.group_employment", "Employment")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldRow
            label={t("team.worker_type", "Worker type")}
            value={e.worker_type ? String(t(`team.worker_type_${e.worker_type}`, e.worker_type)) : null}
          />
          <FieldRow
            label={t("team.employment_status", "Status")}
            value={e.employment_status ? String(t(`team.status_${e.employment_status}`, e.employment_status)) : null}
          />
          <FieldRow label={t("team.hire_date", "Hire date")} value={e.hire_date} />
        </div>
      </FieldGroup>
    </div>
  );
}
