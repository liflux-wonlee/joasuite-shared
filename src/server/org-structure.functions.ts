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
            .select("id, name, code")
            .eq("tenant_id", data.tenant_id)
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
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);
      const { data: dept, error } = await deps.supabaseAdmin
        .from("departments")
        .insert({
          tenant_id: data.tenant_id,
          name: data.name,
          code: data.code ? data.code.toUpperCase() : null,
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
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanManageOrgStructure(data.tenant_id, (context as any).userId);
      const { error } = await deps.supabaseAdmin
        .from("departments")
        .update({ name: data.name, code: data.code ? data.code.toUpperCase() : null })
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
