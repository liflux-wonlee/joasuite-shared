import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Users, Search } from "lucide-react";
import { useJoaSuite } from "../../context";
import { TeamMemberForm } from "./TeamMemberForm";

export type TeamListPageProps = {
  tenantId: string;
  /** Called after any create/edit save, in addition to closing the dialog — e.g. so a host app can trigger its own app-specific follow-up (JoaSOP re-runs Requirements Matrix auto-assignment when the saved entry is linked to a tenant login). */
  onEntrySaved?: (result: { party_id: string; created: boolean }) => void;
};

export function TeamListPage({ tenantId, onEntrySaved }: TeamListPageProps) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const {
    Button,
    Input,
    Badge,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } = ui;

  const [search, setSearch] = useState("");
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ["team-list", tenantId, search],
    enabled: !!tenantId,
    queryFn: () => fns.listTeamMembers({ tenant_id: tenantId, search: search || undefined }),
  });
  const rows = listQ.data?.rows ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {t("team.title", "Team")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "team.desc",
              "Basic employee and contractor info shared across JoaSuite apps.",
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("team.add", "Add person")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("team.search_placeholder", "Search name or email")}
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 min-w-[220px]">{t("team.col_name", "Name")}</th>
              <th className="px-3 py-2 min-w-[140px]">{t("team.department", "Department")}</th>
              <th className="px-3 py-2 min-w-[140px]">{t("team.position", "Position")}</th>
              <th className="px-3 py-2 min-w-[110px]">{t("team.worker_type", "Worker type")}</th>
              <th className="px-3 py-2 min-w-[100px]">{t("team.employment_status", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {!listQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("team.empty", "No team members yet.")}
                </td>
              </tr>
            )}
            {rows.map((r: any) => (
              <tr
                key={r.party_id}
                className="border-t hover:bg-muted/30 cursor-pointer"
                onClick={() => setEditingPartyId(r.party_id)}
              >
                <td className="px-3 py-2">
                  <div className="font-medium truncate">{r.name_en ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.contact_email}</div>
                </td>
                <td className="px-3 py-2">{r.department ?? "—"}</td>
                <td className="px-3 py-2">{r.position ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {t(`team.worker_type_${r.worker_type ?? "employee"}`, r.worker_type ?? "employee")}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {r.employment_status
                    ? t(`team.status_${r.employment_status}`, String(r.employment_status))
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("team.add", "Add person")}</DialogTitle>
          </DialogHeader>
          <TeamMemberForm
            tenantId={tenantId}
            onSaved={(res) => {
              setAddOpen(false);
              onEntrySaved?.(res);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPartyId} onOpenChange={(open: boolean) => !open && setEditingPartyId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("team.edit", "Edit team member")}</DialogTitle>
          </DialogHeader>
          {editingPartyId && (
            <TeamMemberForm
              tenantId={tenantId}
              partyId={editingPartyId}
              onSaved={(res) => {
                setEditingPartyId(null);
                onEntrySaved?.(res);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
