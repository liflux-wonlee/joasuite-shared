import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";

type DeptDialogState = { open: boolean; id?: string; name: string; code: string };
type PosDialogState = { open: boolean; id?: string; departmentId: string; name: string };

export function OrgStructureSettingsPage({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const { Button, Input, Label, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } = ui;
  const qc = useQueryClient();

  const orgQ = useQuery({
    queryKey: ["directory-org", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.listDepartmentsAndPositions({ tenant_id: tenantId }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["directory-org", tenantId] });

  const [deptDialog, setDeptDialog] = useState<DeptDialogState>({ open: false, name: "", code: "" });
  const [posDialog, setPosDialog] = useState<PosDialogState>({ open: false, departmentId: "", name: "" });

  const saveDept = useMutation({
    mutationFn: async () => {
      if (deptDialog.id) {
        await fns.updateDepartment({
          tenant_id: tenantId,
          id: deptDialog.id,
          name: deptDialog.name,
          code: deptDialog.code || undefined,
        });
      } else {
        await fns.createDepartment({
          tenant_id: tenantId,
          name: deptDialog.name,
          code: deptDialog.code || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      invalidate();
      setDeptDialog({ open: false, name: "", code: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDept = useMutation({
    mutationFn: (id: string) => fns.deleteDepartment({ tenant_id: tenantId, id }),
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePos = useMutation({
    mutationFn: async () => {
      if (posDialog.id) {
        await fns.updatePosition({ tenant_id: tenantId, id: posDialog.id, name: posDialog.name });
      } else {
        await fns.createPosition({
          tenant_id: tenantId,
          department_id: posDialog.departmentId,
          name: posDialog.name,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      invalidate();
      setPosDialog({ open: false, departmentId: "", name: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePos = useMutation({
    mutationFn: (id: string) => fns.deletePosition({ tenant_id: tenantId, id }),
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const departments = orgQ.data?.departments ?? [];
  const positions = orgQ.data?.positions ?? [];

  return (
    <div className="py-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t("directory.org_structure_title", "Departments & Positions")}
        </h1>
        <Button size="sm" onClick={() => setDeptDialog({ open: true, name: "", code: "" })}>
          <Plus className="h-4 w-4 mr-1" /> {t("directory.new_department", "New department")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "directory.org_structure_desc",
          "Shared across JoaSuite apps. Used by the Employee Directory and requirements matching.",
        )}
      </p>

      {orgQ.isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}

      {!orgQ.isLoading && departments.length === 0 && (
        <div className="border rounded-lg p-10 text-center text-muted-foreground">
          {t("directory.no_departments", "No departments yet.")}
        </div>
      )}

      <div className="space-y-3">
        {departments.map((d: any) => (
          <div key={d.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-3 bg-muted/30">
              <div className="font-medium">
                {d.name} {d.code && <span className="text-xs text-muted-foreground">({d.code})</span>}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPosDialog({ open: true, departmentId: d.id, name: "" })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t("directory.new_position", "Position")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeptDialog({ open: true, id: d.id, name: d.name, code: d.code ?? "" })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(t("directory.confirm_delete", "Delete this?"))) removeDept.mutate(d.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <ul className="divide-y">
              {positions
                .filter((p: any) => p.department_id === d.id)
                .map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPosDialog({ open: true, id: p.id, departmentId: d.id, name: p.name })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(t("directory.confirm_delete", "Delete this?"))) removePos.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              {positions.filter((p: any) => p.department_id === d.id).length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t("directory.no_positions", "No positions in this department yet.")}
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={deptDialog.open} onOpenChange={(open: boolean) => setDeptDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <form
            onSubmit={(e: any) => {
              e.preventDefault();
              saveDept.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>
                {deptDialog.id
                  ? t("directory.edit_department", "Edit department")
                  : t("directory.new_department", "New department")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t("directory.department_name", "Name")}</Label>
              <Input
                value={deptDialog.name}
                onChange={(e: any) => setDeptDialog((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("directory.department_code", "Code (optional)")}</Label>
              <Input
                value={deptDialog.code}
                onChange={(e: any) => setDeptDialog((s) => ({ ...s, code: e.target.value }))}
                maxLength={20}
                placeholder="OPS"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeptDialog({ open: false, name: "", code: "" })}
                disabled={saveDept.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saveDept.isPending || !deptDialog.name.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={posDialog.open} onOpenChange={(open: boolean) => setPosDialog((s) => ({ ...s, open }))}>
        <DialogContent>
          <form
            onSubmit={(e: any) => {
              e.preventDefault();
              savePos.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>
                {posDialog.id
                  ? t("directory.edit_position", "Edit position")
                  : t("directory.new_position", "New position")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t("directory.position_name", "Name")}</Label>
              <Input
                value={posDialog.name}
                onChange={(e: any) => setPosDialog((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPosDialog({ open: false, departmentId: "", name: "" })}
                disabled={savePos.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={savePos.isPending || !posDialog.name.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
