import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

const ANY = "__any__";
const WORKER_TYPES = ["employee", "contractor"] as const;
const EMPLOYMENT_STATUSES = ["active", "on_leave", "terminated"] as const;

export type TeamMemberFormProps = {
  tenantId: string;
  /** Edit an existing team member by party id (no login required). */
  partyId?: string;
  /** Edit (or create) the team member tied to an existing tenant login. */
  linkedUserId?: string;
  /** Disable all fields; used for self-view / read-only embeds. */
  readOnly?: boolean;
  /** Preselect worker type for a brand-new entry (e.g. opened from a Contractor-only view). Still editable. */
  defaultWorkerType?: "employee" | "contractor";
  onSaved?: (result: { party_id: string; created: boolean }) => void;
};

/**
 * Shared basic Employee/Contractor info form — name/contact, department,
 * position, manager, employment status/dates, worker type. Reused
 * identically (same code, no per-app fork) across every JoaSuite app except
 * the future JoaHR app. Never touches HR-confidential fields (compensation,
 * contracts, leave) — those stay in each app's own HR-owned tables.
 *
 * No Dialog/Card chrome of its own — callers embed it inline (e.g. a
 * read-only Profile tab) or wrap it in their own Dialog (e.g. an "Add team
 * member" flow) as fits the surrounding page.
 */
export function TeamMemberForm({
  tenantId,
  partyId,
  linkedUserId,
  readOnly,
  defaultWorkerType,
  onSaved,
}: TeamMemberFormProps) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const { Button, Input, Label, EmailInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = ui;
  const qc = useQueryClient();

  const orgQ = useQuery({
    queryKey: ["team-org", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.listDepartmentsAndPositions({ tenant_id: tenantId }),
  });

  const entryQ = useQuery({
    queryKey: ["team-member", tenantId, partyId],
    enabled: !!tenantId && !!partyId,
    queryFn: () => fns.getTeamMember({ tenant_id: tenantId, party_id: partyId! }),
  });

  const [nameEn, setNameEn] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [departmentId, setDepartmentId] = useState<string>(ANY);
  const [positionId, setPositionId] = useState<string>(ANY);
  const [employmentStatus, setEmploymentStatus] = useState<string>("active");
  const [hireDate, setHireDate] = useState<string>("");
  const [workerType, setWorkerType] = useState<string>(defaultWorkerType ?? "employee");

  useEffect(() => {
    const e: any = entryQ.data;
    if (!e) return;
    setNameEn(e.name_en ?? "");
    setContactEmail(e.contact_email ?? "");
    setContactPhone(e.contact_phone ?? "");
    setDepartmentId(e.department_id ?? ANY);
    setPositionId(e.position_id ?? ANY);
    setEmploymentStatus(e.employment_status ?? "active");
    setHireDate(e.hire_date ?? "");
    setWorkerType(e.worker_type ?? "employee");
  }, [entryQ.data]);

  const save = useMutation({
    mutationFn: () =>
      fns.upsertTeamMember({
        tenant_id: tenantId,
        party_id: partyId,
        linked_user_id: partyId ? undefined : linkedUserId,
        name_en: nameEn.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        department_id: departmentId === ANY ? null : departmentId,
        position_id: positionId === ANY ? null : positionId,
        employment_status: employmentStatus as (typeof EMPLOYMENT_STATUSES)[number],
        hire_date: hireDate || null,
        worker_type: workerType as (typeof WORKER_TYPES)[number],
      }),
    onSuccess: (res) => {
      toast.success(t("team.saved", "Team member saved"));
      qc.invalidateQueries({ queryKey: ["team-member", tenantId, partyId] });
      qc.invalidateQueries({ queryKey: ["team-list", tenantId] });
      onSaved?.(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Team Members are HR/directory records first — creating one never
  // auto-invites a login (some workers never need one). Inviting is a
  // separate, explicit admin action: it invites-or-links this person's
  // account and grants them the "employee" role for THIS app only, then
  // links parties.linked_user_id so future self-scoped views resolve them.
  const invite = useMutation({
    mutationFn: () =>
      fns.inviteTenantUser({
        tenant_id: tenantId,
        email: contactEmail.trim(),
        display_name: nameEn.trim(),
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

  const isNew = !partyId && !linkedUserId;
  const departments = orgQ.data?.departments ?? [];
  const positions = (orgQ.data?.positions ?? []).filter(
    (p: any) => departmentId === ANY || p.department_id === departmentId,
  );

  if (partyId && entryQ.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-3">
      {(isNew || linkedUserId) && (
        <>
          <div>
            <Label>{t("team.name", "Name")}</Label>
            <Input value={nameEn} onChange={(e: any) => setNameEn(e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <Label>{t("team.contact_email", "Email")}</Label>
            <EmailInput
              value={contactEmail}
              onChange={(e: any) => setContactEmail(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>{t("team.contact_phone", "Phone")}</Label>
            <Input value={contactPhone} onChange={(e: any) => setContactPhone(e.target.value)} disabled={readOnly} />
          </div>
        </>
      )}

      {partyId && !readOnly && (
        <div className="rounded-md border p-3 space-y-1.5">
          {(entryQ.data as any)?.linked_user_id ? (
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
                disabled={invite.isPending || !contactEmail.trim() || !nameEn.trim()}
              >
                {invite.isPending
                  ? t("team.inviting", "Inviting…")
                  : t("team.invite_as_user", "Invite as user")}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("team.department", "Department")}</Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("team.none", "None")}</SelectItem>
              {departments.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("team.position", "Position")}</Label>
          <Select value={positionId} onValueChange={setPositionId} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("team.none", "None")}</SelectItem>
              {positions.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("team.worker_type", "Worker type")}</Label>
          <Select value={workerType} onValueChange={setWorkerType} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKER_TYPES.map((w) => (
                <SelectItem key={w} value={w}>
                  {t(`team.worker_type_${w}`, w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("team.employment_status", "Status")}</Label>
          <Select value={employmentStatus} onValueChange={setEmploymentStatus} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`team.status_${s}`, s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>{t("team.hire_date", "Hire date")}</Label>
        <Input type="date" value={hireDate} onChange={(e: any) => setHireDate(e.target.value)} disabled={readOnly} />
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || (isNew && !nameEn.trim())}>
            {save.isPending ? t("set.sending", "Sending…") : t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
