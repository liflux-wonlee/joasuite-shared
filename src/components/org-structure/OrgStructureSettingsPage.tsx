import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Building2, Network, ListTree } from "lucide-react";
import { toast } from "sonner";
import { useJoaSuite } from "../../context";
import { OrgChartView } from "./OrgChartView";

const ANY_PARENT = "__top_level__";

type DeptDialogState = {
  open: boolean;
  id?: string;
  name: string;
  code: string;
  parentDepartmentId: string;
};
type PosDialogState = { open: boolean; id?: string; departmentId: string; name: string };

type Department = {
  id: string;
  name: string;
  code: string | null;
  parent_department_id: string | null;
  depth: number;
};

function buildDeptTree(departments: Department[]) {
  const byParent = new Map<string | null, Department[]>();
  for (const d of departments) {
    const key = d.parent_department_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(d);
    byParent.set(key, arr);
  }
  const order: Department[] = [];
  const walk = (parentId: string | null) => {
    for (const d of byParent.get(parentId) ?? []) {
      order.push(d);
      walk(d.id);
    }
  };
  walk(null);
  return order;
}

/** Departments this one may legally be re-parented under: not itself, not any of its own descendants. */
function eligibleParents(departments: Department[], excludeId: string | undefined) {
  if (!excludeId) return departments;
  const excluded = new Set<string>([excludeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of departments) {
      if (d.parent_department_id && excluded.has(d.parent_department_id) && !excluded.has(d.id)) {
        excluded.add(d.id);
        changed = true;
      }
    }
  }
  return departments.filter((d) => !excluded.has(d.id));
}

export function OrgStructureSettingsPage({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const { ui, fns } = useJoaSuite();
  const {
    Button,
    Input,
    Label,
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsList,
    TabsTrigger,
  } = ui;
  const qc = useQueryClient();

  const [view, setView] = useState<"manage" | "chart">("manage");

  const orgQ = useQuery({
    queryKey: ["team-org-structure", tenantId],
    enabled: !!tenantId,
    queryFn: () => fns.listDepartmentsAndPositions({ tenant_id: tenantId }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["team-org-structure", tenantId] });

  const [deptDialog, setDeptDialog] = useState<DeptDialogState>({
    open: false,
    name: "",
    code: "",
    parentDepartmentId: ANY_PARENT,
  });
  const [posDialog, setPosDialog] = useState<PosDialogState>({ open: false, departmentId: "", name: "" });

  const saveDept = useMutation({
    mutationFn: async () => {
      const parent_department_id = deptDialog.parentDepartmentId === ANY_PARENT ? null : deptDialog.parentDepartmentId;
      if (deptDialog.id) {
        await fns.updateDepartment({
          tenant_id: tenantId,
          id: deptDialog.id,
          name: deptDialog.name,
          code: deptDialog.code || undefined,
          parent_department_id,
        });
      } else {
        await fns.createDepartment({
          tenant_id: tenantId,
          name: deptDialog.name,
          code: deptDialog.code || undefined,
          parent_department_id,
        });
      }
    },
    onSuccess: () => {
      toast.success(t("set.updated", "Updated"));
      invalidate();
      setDeptDialog({ open: false, name: "", code: "", parentDepartmentId: ANY_PARENT });
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

  const departments: Department[] = orgQ.data?.departments ?? [];
  const positions = orgQ.data?.positions ?? [];
  const orderedDepartments = buildDeptTree(departments);
  const canAddSubDepartment = (d: Department) => d.depth < 4;

  return (
    <div className="py-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t("team.org_structure_title", "Departments & Positions")}
        </h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v: string) => setView(v as "manage" | "chart")}>
            <TabsList>
              <TabsTrigger value="manage">
                <ListTree className="h-3.5 w-3.5 mr-1" /> {t("team.view_manage", "Manage")}
              </TabsTrigger>
              <TabsTrigger value="chart">
                <Network className="h-3.5 w-3.5 mr-1" /> {t("team.view_chart", "Org chart")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "manage" && (
            <Button
              size="sm"
              onClick={() =>
                setDeptDialog({ open: true, name: "", code: "", parentDepartmentId: ANY_PARENT })
              }
            >
              <Plus className="h-4 w-4 mr-1" /> {t("team.new_department", "New department")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "team.org_structure_desc",
          "Shared across JoaSuite apps. Used by Team and requirements matching.",
        )}
      </p>

      {view === "chart" ? (
        <OrgChartView tenantId={tenantId} />
      ) : (
        <>
          {orgQ.isLoading && <div className="text-sm text-muted-foreground">{t("common.loading")}</div>}

          {!orgQ.isLoading && departments.length === 0 && (
            <div className="border rounded-lg p-10 text-center text-muted-foreground">
              {t("team.no_departments", "No departments yet.")}
            </div>
          )}

          <div className="space-y-3">
            {orderedDepartments.map((d) => (
              <div
                key={d.id}
                className="border rounded-lg overflow-hidden"
                style={{ marginLeft: (d.depth - 1) * 20 }}
              >
                <div className="flex items-center justify-between gap-2 p-3 bg-muted/30">
                  <div className="font-medium">
                    {d.name} {d.code && <span className="text-xs text-muted-foreground">({d.code})</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {canAddSubDepartment(d) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeptDialog({ open: true, name: "", code: "", parentDepartmentId: d.id })
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t("team.new_sub_department", "Sub-department")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPosDialog({ open: true, departmentId: d.id, name: "" })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> {t("team.new_position", "Position")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDeptDialog({
                          open: true,
                          id: d.id,
                          name: d.name,
                          code: d.code ?? "",
                          parentDepartmentId: d.parent_department_id ?? ANY_PARENT,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t("team.confirm_delete", "Delete this?"))) removeDept.mutate(d.id);
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
                              if (confirm(t("team.confirm_delete", "Delete this?"))) removePos.mutate(p.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  {positions.filter((p: any) => p.department_id === d.id).length === 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      {t("team.no_positions", "No positions in this department yet.")}
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={deptDialog.open}
        onOpenChange={(open: boolean) =>
          setDeptDialog((s) => ({ ...s, open, ...(open ? {} : { name: "", code: "" }) }))
        }
      >
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
                  ? t("team.edit_department", "Edit department")
                  : t("team.new_department", "New department")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t("team.department_name", "Name")}</Label>
              <Input
                value={deptDialog.name}
                onChange={(e: any) => setDeptDialog((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("team.department_code", "Code (optional)")}</Label>
              <Input
                value={deptDialog.code}
                onChange={(e: any) => setDeptDialog((s) => ({ ...s, code: e.target.value }))}
                maxLength={20}
                placeholder="OPS"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("team.parent_department", "Parent department")}</Label>
              <Select
                value={deptDialog.parentDepartmentId}
                onValueChange={(v: string) => setDeptDialog((s) => ({ ...s, parentDepartmentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_PARENT}>{t("team.top_level", "None (top-level)")}</SelectItem>
                  {eligibleParents(departments, deptDialog.id).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {"—".repeat(d.depth - 1)} {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("team.department_depth_hint", "Departments can nest up to 4 levels deep.")}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeptDialog({ open: false, name: "", code: "", parentDepartmentId: ANY_PARENT })}
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
                  ? t("team.edit_position", "Edit position")
                  : t("team.new_position", "New position")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t("team.position_name", "Name")}</Label>
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
