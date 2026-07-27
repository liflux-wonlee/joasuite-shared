/**
 * Shared Team (Employee/Contractor) + org-structure (Departments/Positions/
 * OrgChart) module — plain business-logic functions, deliberately NOT
 * wrapped in `createServerFn()` here.
 *
 * History: this used to export `createServerFn().middleware([...])`-wrapped
 * factories directly (`createListTeamMembers(deps)` etc., taking
 * `deps.requireSupabaseAuth`). In production, `context.supabase`/
 * `context.userId` injected by that per-function `.middleware()` composition
 * would sometimes arrive at the handler as an empty object -- confirmed via
 * a temporary diagnostic guard that fired with genuinely empty context,
 * despite the middleware wiring and gate functions all checking out correct
 * in source across multiple rounds of review. The one thing that reliably
 * fixed it (confirmed independently in joasop, then replicated in joaoffice
 * and joahr) was moving the `createServerFn()` call itself into each app's
 * own source tree, where that app's own TanStack Start/router-plugin build
 * step processes it directly, instead of inside this package's pre-compiled
 * npm dist output.
 *
 * So the split now is: this file owns the actual Supabase queries and
 * authorization logic (the part that's genuinely identical across apps and
 * worth sharing); each consuming app's own `team.functions.ts` supplies a
 * thin `createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 * .inputValidator(...).handler(({data, context}) => xServer(data, context
 * as never, deps))` wrapper living in its own source, so the createServerFn
 * boundary is always app-local.
 *
 * Team member read/write gates are hardcoded (not dependency-injected) --
 * per the original design intent, these must NOT diverge per app. Departments/
 * positions/org-chart authorization DOES vary per app (e.g. JoaSOP gates on
 * its own sop_admin/sop_author/sop_reviewer roles plus an active JoaSOP
 * subscription; JoaHR uses its own assertJoahrRole), so those take an
 * `OrgStructureDeps` gate pair injected by the caller.
 */

export type TeamContext = {
  supabase: any;
  userId: string;
};

export type OrgStructureDeps = {
  /** Read-gate: any tenant member who may see the org structure. */
  assertCanReadOrgStructure: (supabase: any, tenantId: string, userId: string) => Promise<void>;
  /** Write-gate: who may create/edit/delete departments and positions. */
  assertCanManageOrgStructure: (supabase: any, tenantId: string, userId: string) => Promise<void>;
};

export const MAX_DEPARTMENT_DEPTH = 4;

type DeptRow = { id: string; parent_department_id: string | null; depth: number };

export type ListTeamMembersInput = {
  tenant_id: string;
  search?: string;
  worker_type?: "employee" | "contractor";
};

export type TeamMemberInput = {
  tenant_id: string;
  party_id: string;
};

export type UpsertTeamMemberInput = {
  tenant_id: string;
  party_id?: string;
  linked_user_id?: string;
  name_en?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  manager_id?: string | null;
  employment_status?: "active" | "on_leave" | "terminated";
  hire_date?: string | null;
  termination_date?: string | null;
  worker_type: "employee" | "contractor";
};

export type TenantInput = { tenant_id: string };

export type CreateDepartmentInput = {
  tenant_id: string;
  name: string;
  code?: string | null;
  parent_department_id?: string | null;
};

export type UpdateDepartmentInput = CreateDepartmentInput & { id: string };
export type DeleteDepartmentInput = { tenant_id: string; id: string };

export type CreatePositionInput = {
  tenant_id: string;
  department_id: string;
  name: string;
};

export type UpdatePositionInput = { tenant_id: string; id: string; name: string };
export type DeletePositionInput = { tenant_id: string; id: string };

/**
 * Read-gate for the Team directory: any internal staff member of the tenant.
 * Write-gate: owner / super_admin / admin / hr_manager. Identical across
 * every JoaSuite app that has this Team feature (joabooks/joaoffice/joasop) —
 * do not diverge these two checks per app; that's why they're hardcoded
 * rather than DI'd like the org-structure gates below.
 */
async function assertCanReadTeam(supabase: any, tenantId: string, userId: string) {
  const { data: ok, error } = await supabase.rpc("is_internal_staff", {
    _tenant: tenantId,
    _user: userId,
  });
  if (error) throw new Error(error.message);
  if (!ok) throw new Error("Forbidden");
}

async function assertCanWriteTeam(supabase: any, tenantId: string, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => ["owner", "super_admin", "admin", "hr_manager"].includes(r))) {
    throw new Error("Forbidden: owner, super_admin, admin, or hr_manager required");
  }
}

async function loadDeptPosNames(supabase: any, tenantId: string, deptIds: string[], posIds: string[]) {
  const [{ data: depts, error: deptErr }, { data: positions, error: posErr }] = await Promise.all([
    deptIds.length
      ? supabase.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", deptIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    posIds.length
      ? supabase.from("positions").select("id, name").eq("tenant_id", tenantId).in("id", posIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ]);
  if (deptErr) throw new Error(deptErr.message);
  if (posErr) throw new Error(posErr.message);
  return {
    deptName: new Map<string, string>((depts ?? []).map((d: any) => [d.id, d.name])),
    posName: new Map<string, string>((positions ?? []).map((p: any) => [p.id, p.name])),
  };
}

async function fetchAllDepartments(supabase: any, tenantId: string): Promise<DeptRow[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, parent_department_id, depth")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function isDescendantOf(all: DeptRow[], candidateAncestorId: string, ofId: string): boolean {
  const byId = new Map(all.map((d) => [d.id, d]));
  let cur = byId.get(ofId);
  const seen = new Set<string>();
  while (cur?.parent_department_id) {
    if (seen.has(cur.id)) return false;
    seen.add(cur.id);
    if (cur.parent_department_id === candidateAncestorId) return true;
    cur = byId.get(cur.parent_department_id);
  }
  return false;
}

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
    const next = queue.shift();
    if (!next) continue;
    out.push(next);
    queue.push(...(childrenOf.get(next.id) ?? []));
  }
  return out;
}

export async function listTeamMembersServer(input: ListTeamMembersInput, context: TeamContext) {
  await assertCanReadTeam(context.supabase, input.tenant_id, context.userId);

  let query = context.supabase
    .from("parties")
    .select("id, linked_user_id, name_en, contact_email, contact_phone, active")
    .eq("tenant_id", input.tenant_id)
    .eq("is_employee", true)
    .order("name_en");

  if (input.search?.trim()) {
    const search = input.search.trim().replace(/[%,()]/g, "");
    query = query.or(`name_en.ilike.%${search}%,contact_email.ilike.%${search}%`);
  }

  const { data: parties, error } = await query;
  if (error) throw new Error(error.message);

  const partyIds = (parties ?? []).map((party: any) => party.id as string);
  let profiles: Array<{
    party_id: string;
    department_id: string | null;
    position_id: string | null;
    manager_id: string | null;
    employment_status: string | null;
    hire_date: string | null;
    termination_date: string | null;
    worker_type: string | null;
  }> = [];

  if (partyIds.length) {
    const { data, error: profileErr } = await context.supabase
      .from("employee_profiles")
      .select("party_id, department_id, position_id, manager_id, employment_status, hire_date, termination_date, worker_type")
      .eq("tenant_id", input.tenant_id)
      .in("party_id", partyIds);
    if (profileErr) throw new Error(profileErr.message);
    profiles = data ?? [];
  }

  const byParty = new Map(profiles.map((profile) => [profile.party_id, profile]));
  const deptIds = Array.from(new Set(profiles.map((profile) => profile.department_id).filter((id): id is string => Boolean(id))));
  const posIds = Array.from(new Set(profiles.map((profile) => profile.position_id).filter((id): id is string => Boolean(id))));
  const { deptName, posName } = await loadDeptPosNames(context.supabase, input.tenant_id, deptIds, posIds);

  let rows = (parties ?? []).map((party: any) => {
    const profile = byParty.get(party.id);
    return {
      party_id: party.id,
      linked_user_id: party.linked_user_id ?? null,
      name_en: party.name_en,
      contact_email: party.contact_email,
      contact_phone: party.contact_phone,
      active: party.active,
      department_id: profile?.department_id ?? null,
      department: profile?.department_id ? (deptName.get(profile.department_id) ?? null) : null,
      position_id: profile?.position_id ?? null,
      position: profile?.position_id ? (posName.get(profile.position_id) ?? null) : null,
      manager_id: profile?.manager_id ?? null,
      employment_status: profile?.employment_status ?? null,
      hire_date: profile?.hire_date ?? null,
      termination_date: profile?.termination_date ?? null,
      worker_type: profile?.worker_type ?? "employee",
    };
  });

  if (input.worker_type) {
    rows = rows.filter((row: { worker_type: string }) => row.worker_type === input.worker_type);
  }

  return { rows };
}

export async function getTeamMemberServer(input: TeamMemberInput, context: TeamContext) {
  await assertCanReadTeam(context.supabase, input.tenant_id, context.userId);

  const { data: party, error } = await context.supabase
    .from("parties")
    .select("id, linked_user_id, name_en, contact_email, contact_phone, active, is_employee")
    .eq("tenant_id", input.tenant_id)
    .eq("id", input.party_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!party || !party.is_employee) throw new Error("Team member not found");

  const { data: profile, error: profileErr } = await context.supabase
    .from("employee_profiles")
    .select("party_id, department_id, position_id, manager_id, employment_status, hire_date, termination_date, worker_type")
    .eq("tenant_id", input.tenant_id)
    .eq("party_id", input.party_id)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);

  const { deptName, posName } = await loadDeptPosNames(
    context.supabase,
    input.tenant_id,
    profile?.department_id ? [profile.department_id] : [],
    profile?.position_id ? [profile.position_id] : [],
  );

  return {
    party_id: party.id,
    linked_user_id: party.linked_user_id ?? null,
    name_en: party.name_en,
    contact_email: party.contact_email,
    contact_phone: party.contact_phone,
    active: party.active,
    department_id: profile?.department_id ?? null,
    department: profile?.department_id ? (deptName.get(profile.department_id) ?? null) : null,
    position_id: profile?.position_id ?? null,
    position: profile?.position_id ? (posName.get(profile.position_id) ?? null) : null,
    manager_id: profile?.manager_id ?? null,
    employment_status: profile?.employment_status ?? null,
    hire_date: profile?.hire_date ?? null,
    termination_date: profile?.termination_date ?? null,
    worker_type: profile?.worker_type ?? null,
  };
}

/**
 * `appCode`, if given, is stamped onto `parties.source_app`/
 * `employee_profiles.source_app` (both nullable) so multi-app records can be
 * traced back to whichever app created/last wrote them. Purely informational
 * — omit it and the columns are simply left null.
 */
export async function upsertTeamMemberServer(input: UpsertTeamMemberInput, context: TeamContext, appCode?: string) {
  await assertCanWriteTeam(context.supabase, input.tenant_id, context.userId);

  let partyId: string;
  let created = false;

  if (input.party_id) {
    partyId = input.party_id;
    const patch: Record<string, unknown> = { is_employee: true };
    if (input.name_en !== undefined) patch.name_en = input.name_en;
    if (input.contact_email !== undefined) patch.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) patch.contact_phone = input.contact_phone;
    const { error } = await context.supabase
      .from("parties")
      .update(patch)
      .eq("id", partyId)
      .eq("tenant_id", input.tenant_id);
    if (error) throw new Error(error.message);
  } else if (input.linked_user_id) {
    const { data: existingParty, error: findErr } = await context.supabase
      .from("parties")
      .select("id")
      .eq("tenant_id", input.tenant_id)
      .eq("linked_user_id", input.linked_user_id)
      .eq("is_employee", true)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existingParty) {
      partyId = existingParty.id;
    } else {
      const { data: member, error: memberErr } = await context.supabase
        .from("tenant_users")
        .select("display_name, email")
        .eq("tenant_id", input.tenant_id)
        .eq("user_id", input.linked_user_id)
        .maybeSingle();
      if (memberErr) throw new Error(memberErr.message);
      if (!member) throw new Error("This person is not a member of this workspace");

      const { data: newParty, error: insertErr } = await context.supabase
        .from("parties")
        .insert({
          tenant_id: input.tenant_id,
          linked_user_id: input.linked_user_id,
          name_en: input.name_en ?? member.display_name ?? member.email ?? "Unnamed",
          contact_email: input.contact_email ?? member.email ?? null,
          contact_phone: input.contact_phone ?? null,
          is_employee: true,
          ...(appCode ? { source_app: appCode } : {}),
        })
        .select("id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      partyId = newParty.id;
      created = true;
    }
  } else {
    if (!input.name_en) throw new Error("name_en is required to create a new team member");
    const { data: newParty, error: insertErr } = await context.supabase
      .from("parties")
      .insert({
        tenant_id: input.tenant_id,
        name_en: input.name_en,
        contact_email: input.contact_email ?? null,
        contact_phone: input.contact_phone ?? null,
        is_employee: true,
        ...(appCode ? { source_app: appCode } : {}),
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);
    partyId = newParty.id;
    created = true;
  }

  const { data: existingProfile, error: findProfileErr } = await context.supabase
    .from("employee_profiles")
    .select("id")
    .eq("tenant_id", input.tenant_id)
    .eq("party_id", partyId)
    .maybeSingle();
  if (findProfileErr) throw new Error(findProfileErr.message);

  const profilePatch = {
    department_id: input.department_id ?? null,
    position_id: input.position_id ?? null,
    manager_id: input.manager_id ?? null,
    worker_type: input.worker_type,
    ...(appCode ? { source_app: appCode } : {}),
    ...(input.hire_date !== undefined ? { hire_date: input.hire_date } : {}),
    ...(input.termination_date !== undefined ? { termination_date: input.termination_date } : {}),
    ...(input.employment_status ? { employment_status: input.employment_status } : {}),
  };

  if (existingProfile) {
    const { error } = await context.supabase.from("employee_profiles").update(profilePatch).eq("id", existingProfile.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await context.supabase.from("employee_profiles").insert({
      tenant_id: input.tenant_id,
      party_id: partyId,
      employment_status: input.employment_status ?? "active",
      ...profilePatch,
    });
    if (error) throw new Error(error.message);
  }

  return { party_id: partyId, created };
}

export async function listDepartmentsAndPositionsServer(input: TenantInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanReadOrgStructure(context.supabase, input.tenant_id, context.userId);
  const [{ data: departments, error: deptErr }, { data: positions, error: posErr }] = await Promise.all([
    context.supabase
      .from("departments")
      .select("id, name, code, parent_department_id, depth")
      .eq("tenant_id", input.tenant_id)
      .order("depth")
      .order("name"),
    context.supabase.from("positions").select("id, name, department_id").eq("tenant_id", input.tenant_id).order("name"),
  ]);
  if (deptErr) throw new Error(deptErr.message);
  if (posErr) throw new Error(posErr.message);
  return { departments: departments ?? [], positions: positions ?? [] };
}

export async function createDepartmentServer(input: CreateDepartmentInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);

  let depth = 1;
  if (input.parent_department_id) {
    const { data: parent, error: parentErr } = await context.supabase
      .from("departments")
      .select("id, depth")
      .eq("tenant_id", input.tenant_id)
      .eq("id", input.parent_department_id)
      .maybeSingle();
    if (parentErr) throw new Error(parentErr.message);
    if (!parent) throw new Error("Parent department not found");
    depth = parent.depth + 1;
    if (depth > MAX_DEPARTMENT_DEPTH) {
      throw new Error(`Departments can nest at most ${MAX_DEPARTMENT_DEPTH} levels deep`);
    }
  }

  const { data, error } = await context.supabase
    .from("departments")
    .insert({
      tenant_id: input.tenant_id,
      name: input.name,
      code: input.code ? input.code.toUpperCase() : null,
      parent_department_id: input.parent_department_id ?? null,
      depth,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function updateDepartmentServer(input: UpdateDepartmentInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);

  const patch: Record<string, unknown> = {
    name: input.name,
    code: input.code ? input.code.toUpperCase() : null,
  };

  if (input.parent_department_id !== undefined) {
    if (input.parent_department_id === input.id) {
      throw new Error("A department cannot be its own parent");
    }
    const all = await fetchAllDepartments(context.supabase, input.tenant_id);
    const current = all.find((dept) => dept.id === input.id);
    if (!current) throw new Error("Department not found");

    let newDepth = 1;
    if (input.parent_department_id) {
      const parent = all.find((dept) => dept.id === input.parent_department_id);
      if (!parent) throw new Error("Parent department not found");
      if (isDescendantOf(all, input.id, input.parent_department_id)) {
        throw new Error("Cannot move a department under one of its own sub-departments");
      }
      newDepth = parent.depth + 1;
    }

    const descendants = collectDescendants(all, input.id);
    const depthDelta = newDepth - current.depth;
    const deepestDescendant = descendants.reduce((max, dept) => Math.max(max, dept.depth), current.depth);
    if (deepestDescendant + depthDelta > MAX_DEPARTMENT_DEPTH) {
      throw new Error(`Departments can nest at most ${MAX_DEPARTMENT_DEPTH} levels deep`);
    }

    patch.parent_department_id = input.parent_department_id ?? null;
    patch.depth = newDepth;

    if (depthDelta !== 0 && descendants.length > 0) {
      const updates = await Promise.all(
        descendants.map((dept) =>
          context.supabase
            .from("departments")
            .update({ depth: dept.depth + depthDelta })
            .eq("id", dept.id)
            .eq("tenant_id", input.tenant_id),
        ),
      );
      for (const update of updates) {
        if (update.error) throw new Error(update.error.message);
      }
    }
  }

  const { error } = await context.supabase
    .from("departments")
    .update(patch)
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteDepartmentServer(input: DeleteDepartmentInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);
  const [{ count: childCount, error: childErr }, { count: posCount, error: posErr }] = await Promise.all([
    context.supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id)
      .eq("parent_department_id", input.id),
    context.supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", input.tenant_id)
      .eq("department_id", input.id),
  ]);
  if (childErr) throw new Error(childErr.message);
  if (posErr) throw new Error(posErr.message);
  if ((childCount ?? 0) > 0) throw new Error("Move or delete this department's sub-departments first");
  if ((posCount ?? 0) > 0) throw new Error("Move or delete this department's positions first");

  const { error } = await context.supabase.from("departments").delete().eq("id", input.id).eq("tenant_id", input.tenant_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createPositionServer(input: CreatePositionInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);
  const { data, error } = await context.supabase
    .from("positions")
    .insert({ tenant_id: input.tenant_id, department_id: input.department_id, name: input.name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function updatePositionServer(input: UpdatePositionInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);
  const { error } = await context.supabase
    .from("positions")
    .update({ name: input.name })
    .eq("id", input.id)
    .eq("tenant_id", input.tenant_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deletePositionServer(input: DeletePositionInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanManageOrgStructure(context.supabase, input.tenant_id, context.userId);
  const { error } = await context.supabase.from("positions").delete().eq("id", input.id).eq("tenant_id", input.tenant_id);
  if (error) throw new Error(error.message);
  return { ok: true };
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

export async function getOrgChartTreeServer(input: TenantInput, context: TeamContext, deps: OrgStructureDeps) {
  await deps.assertCanReadOrgStructure(context.supabase, input.tenant_id, context.userId);

  const [{ data: departments, error: deptErr }, { data: positions, error: posErr }] = await Promise.all([
    context.supabase.from("departments").select("id, name, parent_department_id, depth").eq("tenant_id", input.tenant_id),
    context.supabase.from("positions").select("id, name, department_id").eq("tenant_id", input.tenant_id),
  ]);
  if (deptErr) throw new Error(deptErr.message);
  if (posErr) throw new Error(posErr.message);

  const { data: profiles, error: profileErr } = await context.supabase
    .from("employee_profiles")
    .select("party_id, department_id, position_id, worker_type, employment_status")
    .eq("tenant_id", input.tenant_id)
    .neq("employment_status", "terminated")
    .not("position_id", "is", null);
  if (profileErr) throw new Error(profileErr.message);

  const partyIds = (profiles ?? []).map((profile: any) => profile.party_id as string);
  let parties: Array<{ id: string; name_en: string }> = [];
  if (partyIds.length) {
    const { data, error } = await context.supabase
      .from("parties")
      .select("id, name_en")
      .eq("tenant_id", input.tenant_id)
      .in("id", partyIds);
    if (error) throw new Error(error.message);
    parties = data ?? [];
  }

  const nameByParty = new Map(parties.map((party) => [party.id, party.name_en]));
  const peopleByPosition = new Map<string, OrgChartPerson[]>();
  for (const profile of profiles ?? []) {
    if (!profile.position_id) continue;
    const people = peopleByPosition.get(profile.position_id) ?? [];
    people.push({
      party_id: profile.party_id,
      name: nameByParty.get(profile.party_id) ?? "—",
      worker_type: profile.worker_type ?? null,
    });
    peopleByPosition.set(profile.position_id, people);
  }

  const positionsByDept = new Map<string, OrgChartPosition[]>();
  for (const position of positions ?? []) {
    const rows = positionsByDept.get(position.department_id) ?? [];
    rows.push({ id: position.id, name: position.name, people: peopleByPosition.get(position.id) ?? [] });
    positionsByDept.set(position.department_id, rows);
  }

  const nodeById = new Map<string, OrgChartDepartment>();
  for (const department of departments ?? []) {
    nodeById.set(department.id, {
      id: department.id,
      name: department.name,
      depth: department.depth,
      positions: positionsByDept.get(department.id) ?? [],
      children: [],
    });
  }

  const roots: OrgChartDepartment[] = [];
  for (const department of departments ?? []) {
    const node = nodeById.get(department.id);
    if (!node) continue;
    if (department.parent_department_id && nodeById.has(department.parent_department_id)) {
      nodeById.get(department.parent_department_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return { roots };
}
