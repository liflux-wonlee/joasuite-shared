import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Departments/positions are shared JoaSuite core tables (used by every app
 * that manages an Employee/Contractor Directory entry). Authorization is
 * intentionally injected rather than hardcoded here, since "who may edit
 * org structure" differs per app (e.g. JoaSOP's `sop_admin` vs JoaOffice's
 * `admin`/`hr_manager`) — see docs/joasuite-app-integration-contract.md.
 */
export type OrgStructureDeps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
  /** Read-gate: any tenant member who may see the org structure. */
  assertCanReadOrgStructure: (tenantId: string, userId: string) => Promise<void>;
  /** Write-gate: who may create/edit/delete departments and positions. */
  assertCanManageOrgStructure: (tenantId: string, userId: string) => Promise<void>;
};

/** Departments may nest at most this many levels deep (1 = top-level). */
export const MAX_DEPARTMENT_DEPTH = 4;

type DeptRow = { id: string; parent_department_id: string | null; depth: number };

async function fetchAllDepartments(supabaseAdmin: any, tenantId: string): Promise<DeptRow[]> {
  const { data, error } = await supabaseAdmin
    .from("departments")
    .select("id, parent_department_id, depth")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Walk the parent chain starting at `startId`; returns the chain of ids visited (excluding startId's own future parent loops). */
function isDescendantOf(all: DeptRow[], candidateAncestorId: string, ofId: string): boolean {
  const byId = new Map(all.map((d) => [d.id, d]));
  let cur = byId.get(ofId);
  const seen = new Set<string>();
  while (cur?.parent_department_id) {
    if (seen.has(cur.id)) return false; // already-broken cycle in stored data, bail out
    seen.add(cur.id);
    if (cur.parent_department_id === candidateAncestorId) return true;
    cur = byId.get(cur.parent_department_id);
  }
  return false;
}

/** All descendant ids of `id` (children, grandchildren, ...), via the in-memory full department list. */
function collectDescendants(all: DeptRow[], id: string): DeptRow[] {
  const childrenOf = new Map<string, DeptRow[]>();
  for (const d of all) {
    if (!d.parent_department_id) continue;
    const arr = childrenOf.get(d.parent_department_id) ?? [];
    arr.push(d);
    childrenOf.set(d.parent_department_id, arr);
  }
  const out: DeptRow[] = [];
  const queue = [...(childrenOf.get(id) ?? [])];
  while (queue.length) {
    const next = queue.shift()!;
    out.push(next);
    queue.push(...(childrenOf.get(next.id) ?? []));
  }
  return out;
}

export function createListDepartmentsAndPositions(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      await deps.assertCanReadOrgStructure(data.tenant_id, (context as any).userId);
      const [{ data: departments, error: dErr }, { data: positions, error: pErr }] =
        await Promise.all([
          deps.supabaseAdmin
            .from("departments")
            .select("id, name, code, parent_department_id, depth")
            .eq("tenant_id", data.tenant_id)
            .order("depth")
            .order("name"),
          deps.supabaseAdmin
            .from("positions")
            .select("id, name, department_id")
            .eq("tenant_id", data.tenant_id)
            .order("name"),
        ]);
      if (dErr) throw new Error(dErr.message);
      if (pErr) throw new Error(pErr.message);
      return { departments: departments ?? [], positions: positions ?? [] };
    });
}

export function createCreateDepartment(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          code: z.string().max(20).optional().nullable(),
          parent_department_id: z.string().uuid().optional().nullable(),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);

      let depth = 1;
      if (data.parent_department_id) {
        const { data: parent, error: parentErr } = await deps.supabaseAdmin
          .from("departments")
          .select("id, depth")
          .eq("tenant_id", data.tenant_id)
          .eq("id", data.parent_department_id)
          .maybeSingle();
        if (parentErr) throw new Error(parentErr.message);
        if (!parent) throw new Error("Parent department not found");
        depth = parent.depth + 1;
        if (depth > MAX_DEPARTMENT_DEPTH) {
          throw new Error(`Departments can nest at most ${MAX_DEPARTMENT_DEPTH} levels deep`);
        }
      }

      const { data: dept, error } = await deps.supabaseAdmin
        .from("departments")
        .insert({
          tenant_id: data.tenant_id,
          name: data.name,
          code: data.code ? data.code.toUpperCase() : null,
          parent_department_id: data.parent_department_id ?? null,
          depth,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: dept.id };
    });
}

export function createUpdateDepartment(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          id: z.string().uuid(),
          name: z.string().min(1).max(120),
          code: z.string().max(20).optional().nullable(),
          /** Omit this field to leave the parent unchanged; pass null to promote to top-level. */
          parent_department_id: z.string().uuid().optional().nullable(),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);

      const patch: Record<string, unknown> = {
        name: data.name,
        code: data.code ? data.code.toUpperCase() : null,
      };

      if (data.parent_department_id !== undefined) {
        if (data.parent_department_id === data.id) {
          throw new Error("A department cannot be its own parent");
        }
        const all = await fetchAllDepartments(deps.supabaseAdmin, data.tenant_id);
        const current = all.find((d) => d.id === data.id);
        if (!current) throw new Error("Department not found");

        let newDepth = 1;
        if (data.parent_department_id) {
          const parent = all.find((d) => d.id === data.parent_department_id);
          if (!parent) throw new Error("Parent department not found");
          if (isDescendantOf(all, data.id, data.parent_department_id)) {
            throw new Error("Cannot move a department under one of its own sub-departments");
          }
          newDepth = parent.depth + 1;
        }

        const descendants = collectDescendants(all, data.id);
        const depthDelta = newDepth - current.depth;
        const deepestDescendant = descendants.reduce((max, d) => Math.max(max, d.depth), current.depth);
        if (deepestDescendant + depthDelta > MAX_DEPARTMENT_DEPTH) {
          throw new Error(`Departments can nest at most ${MAX_DEPARTMENT_DEPTH} levels deep`);
        }

        patch.parent_department_id = data.parent_department_id ?? null;
        patch.depth = newDepth;

        if (depthDelta !== 0 && descendants.length > 0) {
          await Promise.all(
            descendants.map((d) =>
              deps.supabaseAdmin
                .from("departments")
                .update({ depth: d.depth + depthDelta })
                .eq("id", d.id)
                .eq("tenant_id", data.tenant_id),
            ),
          );
        }
      }

      const { error } = await deps.supabaseAdmin
        .from("departments")
        .update(patch)
        .eq("id", data.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createDeleteDepartment(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);

      const [{ count: childCount, error: childErr }, { count: posCount, error: posErr }] =
        await Promise.all([
          deps.supabaseAdmin
            .from("departments")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", data.tenant_id)
            .eq("parent_department_id", data.id),
          deps.supabaseAdmin
            .from("positions")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", data.tenant_id)
            .eq("department_id", data.id),
        ]);
      if (childErr) throw new Error(childErr.message);
      if (posErr) throw new Error(posErr.message);
      if ((childCount ?? 0) > 0) {
        throw new Error("Move or delete this department's sub-departments first");
      }
      if ((posCount ?? 0) > 0) {
        throw new Error("Move or delete this department's positions first");
      }

      const { error } = await deps.supabaseAdmin
        .from("departments")
        .delete()
        .eq("id", data.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createCreatePosition(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          department_id: z.string().uuid(),
          name: z.string().min(1).max(120),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);
      const { data: pos, error } = await deps.supabaseAdmin
        .from("positions")
        .insert({ tenant_id: data.tenant_id, department_id: data.department_id, name: data.name })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: pos.id };
    });
}

export function createUpdatePosition(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          id: z.string().uuid(),
          name: z.string().min(1).max(120),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);
      const { error } = await deps.supabaseAdmin
        .from("positions")
        .update({ name: data.name })
        .eq("id", data.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export function createDeletePosition(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z.object({ tenant_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);
      const { error } = await deps.supabaseAdmin
        .from("positions")
        .delete()
        .eq("id", data.id)
        .eq("tenant_id", data.tenant_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    });
}

export type OrgChartPerson = { party_id: string; name: string; worker_type: string | null };
export type OrgChartPosition = { id: string; name: string; people: OrgChartPerson[] };
export type OrgChartDepartment = {
  id: string;
  name: string;
  depth: number;
  positions: OrgChartPosition[];
  children: OrgChartDepartment[];
};

/**
 * Builds the department/position tree for the visual org chart: each
 * department nests its child departments (up to MAX_DEPARTMENT_DEPTH) and
 * its own positions, each position lists the active team members currently
 * holding it. People with no department/position assignment don't have a
 * natural place in a structural chart and are omitted (they still show up
 * in the Team Members list).
 */
export function createGetOrgChartTree(deps: OrgStructureDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(i))
    .handler(async ({ data, context }) => {
      await deps.assertCanReadOrgStructure(data.tenant_id, (context as any).userId);

      const [{ data: departments, error: dErr }, { data: positions, error: pErr }] =
        await Promise.all([
          deps.supabaseAdmin
            .from("departments")
            .select("id, name, parent_department_id, depth")
            .eq("tenant_id", data.tenant_id),
          deps.supabaseAdmin
            .from("positions")
            .select("id, name, department_id")
            .eq("tenant_id", data.tenant_id),
        ]);
      if (dErr) throw new Error(dErr.message);
      if (pErr) throw new Error(pErr.message);

      const { data: profiles, error: profErr } = await deps.supabaseAdmin
        .from("employee_profiles")
        .select("party_id, department_id, position_id, worker_type, employment_status")
        .eq("tenant_id", data.tenant_id)
        .neq("employment_status", "terminated")
        .not("position_id", "is", null);
      if (profErr) throw new Error(profErr.message);

      const partyIds = (profiles ?? []).map((p: any) => p.party_id as string);
      let parties: any[] = [];
      if (partyIds.length) {
        const { data: partyRows, error: partyErr } = await deps.supabaseAdmin
          .from("parties")
          .select("id, name_en")
          .eq("tenant_id", data.tenant_id)
          .in("id", partyIds);
        if (partyErr) throw new Error(partyErr.message);
        parties = partyRows ?? [];
      }
      const nameByParty = new Map<string, string>((parties ?? []).map((p: any) => [p.id, p.name_en]));

      const peopleByPosition = new Map<string, OrgChartPerson[]>();
      for (const prof of profiles ?? []) {
        if (!prof.position_id) continue;
        const arr = peopleByPosition.get(prof.position_id) ?? [];
        arr.push({
          party_id: prof.party_id,
          name: nameByParty.get(prof.party_id) ?? "—",
          worker_type: prof.worker_type ?? null,
        });
        peopleByPosition.set(prof.position_id, arr);
      }

      const positionsByDept = new Map<string, OrgChartPosition[]>();
      for (const pos of positions ?? []) {
        const arr = positionsByDept.get(pos.department_id) ?? [];
        arr.push({ id: pos.id, name: pos.name, people: peopleByPosition.get(pos.id) ?? [] });
        positionsByDept.set(pos.department_id, arr);
      }

      const nodeById = new Map<string, OrgChartDepartment>();
      for (const d of departments ?? []) {
        nodeById.set(d.id, {
          id: d.id,
          name: d.name,
          depth: d.depth,
          positions: positionsByDept.get(d.id) ?? [],
          children: [],
        });
      }
      const roots: OrgChartDepartment[] = [];
      for (const d of departments ?? []) {
        const node = nodeById.get(d.id)!;
        if (d.parent_department_id && nodeById.has(d.parent_department_id)) {
          nodeById.get(d.parent_department_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      return { roots };
    });
}
