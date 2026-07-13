import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Users, Search } from "lucide-react";
import { useJoaSuite } from "../../context";
import { EmployeeProfileForm } from "./EmployeeProfileForm";

export function EmployeeDirectoryListPage({
  tenantId,
  workerType,
}: {
  tenantId: string;
  /** Restrict this view to one worker type. Omit to show the combined directory. */
  workerType?: "employee" | "contractor";
}) {
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
    queryKey: ["directory-list", tenantId, search, workerType],
    enabled: !!tenantId,
    queryFn: () =>
      fns.listEmployeeDirectory({ tenant_id: tenantId, search: search || undefined, worker_type: workerType }),
  });
  const rows = listQ.data?.rows ?? [];

  const title =
    workerType === "employee"
      ? t("directory.title_employee", "Employees")
      : workerType === "contractor"
        ? t("directory.title_contractor", "Contractors")
        : t("directory.title", "Employee Directory");
  const desc =
    workerType === "employee"
      ? t("directory.desc_employee", "People on payroll, shared across JoaSuite apps.")
      : workerType === "contractor"
        ? t("directory.desc_contractor", "External contractors and vendors, shared across JoaSuite apps.")
        : t("directory.desc", "Basic employee and contractor info shared across JoaSuite apps.");
  const addLabel =
    workerType === "employee"
      ? t("directory.add_employee", "Add employee")
      : workerType === "contractor"
        ? t("directory.add_contractor", "Add contractor")
        : t("directory.add", "Add person");

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("directory.search_placeholder", "Search name or email")}
          value={search}
          onChange={(e: any) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 min-w-[220px]">{t("directory.col_name", "Name")}</th>
              <th className="px-3 py-2 min-w-[140px]">{t("directory.department", "Department")}</th>
              <th className="px-3 py-2 min-w-[140px]">{t("directory.position", "Position")}</th>
              {!workerType && (
                <th className="px-3 py-2 min-w-[110px]">{t("directory.worker_type", "Worker type")}</th>
              )}
              <th className="px-3 py-2 min-w-[100px]">{t("directory.employment_status", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {!listQ.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={workerType ? 4 : 5} className="px-3 py-6 text-center text-muted-foreground">
                  {t("directory.empty", "No directory entries yet.")}
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
                {!workerType && (
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {t(`directory.worker_type_${r.worker_type ?? "employee"}`, r.worker_type ?? "employee")}
                    </Badge>
                  </td>
                )}
                <td className="px-3 py-2">
                  {r.employment_status
                    ? t(`directory.status_${r.employment_status}`, String(r.employment_status))
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
            <DialogTitle>{addLabel}</DialogTitle>
          </DialogHeader>
          <EmployeeProfileForm
            tenantId={tenantId}
            defaultWorkerType={workerType}
            onSaved={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPartyId} onOpenChange={(open: boolean) => !open && setEditingPartyId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("directory.edit", "Edit directory entry")}</DialogTitle>
          </DialogHeader>
          {editingPartyId && (
            <EmployeeProfileForm
              tenantId={tenantId}
              partyId={editingPartyId}
              onSaved={() => setEditingPartyId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
