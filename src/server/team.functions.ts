import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Shared Team (Employee/Contractor) module — basic identity + org-placement
 * fields ONLY (name, contact, department, position, manager, employment
 * status/dates, worker_type). Backed entirely by the shared core tables
 * `public.parties` (is_employee = true) and `public.employee_profiles`.
 *
 * Deliberately excludes every HR-confidential field (compensation,
 * contracts, emergency contact, performance reviews, leave/timesheet
 * records) — those remain app-owned (e.g. JoaOffice's
 * `office.employee_hr_records` / `office.employee_pto_balances`, gated by
 * their own role checks). This module must never import from, or grow a
 * dependency on, any app-specific HR schema — every JoaSuite app except
 * the future JoaHR app is expected to embed this same Team module as-is.
 */
export type TeamDeps = {
  requireSupabaseAuth: any;
  supabaseAdmin: any;
  assertCanReadTeam: (tenantId: string, userId: string) => Promise<void>;
  assertCanWriteTeam: (tenantId: string, userId: string) => Promise<void>;
  /** Called after a successful write, e.g. to append an audit_logs row. Optional. */
  onWrite?: (input: {
    tenantId: string;
    userId: string;
    partyId: string;
    created: boolean;
  }) => Promise<void>;
};

const WORKER_TYPES = ["employee", "contractor"] as const;
const EMPLOYMENT_STATUSES = ["active", "on_leave", "terminated"] as const;

async function loadDeptPosNames(supabaseAdmin: any, tenantId: string, deptIds: string[], posIds: string[]) {
  const [{ data: depts }, { data: positions }] = await Promise.all([
    deptIds.length
      ? supabaseAdmin.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", deptIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    posIds.length
      ? supabaseAdmin.from("positions").select("id, name").eq("tenant_id", tenantId).in("id", posIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  return {
    deptName: new Map<string, string>((depts ?? []).map((d: any) => [d.id, d.name])),
    posName: new Map<string, string>((positions ?? []).map((p: any) => [p.id, p.name])),
  };
}

export function createListTeamMembers(deps: TeamDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z.object({ tenant_id: z.string().uuid(), search: z.string().max(200).optional() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanReadTeam(data.tenant_id, (context as any).userId);

      let pq = deps.supabaseAdmin
        .from("parties")
        .select("id, linked_user_id, name_en, contact_email, contact_phone, active")
        .eq("tenant_id", data.tenant_id)
        .eq("is_employee", true)
        .order("name_en");
      if (data.search?.trim()) {
        const s = data.search.trim();
        pq = pq.or(`name_en.ilike.%${s}%,contact_email.ilike.%${s}%`);
      }
      const { data: parties, error: pErr } = await pq;
      if (pErr) throw new Error(pErr.message);

      const partyIds = (parties ?? []).map((p: any) => p.id as string);
      let profiles: any[] = [];
      if (partyIds.length) {
        const { data: profileRows, error: prErr } = await deps.supabaseAdmin
          .from("employee_profiles")
          .select(
            "party_id, department_id, position_id, manager_id, employment_status, hire_date, termination_date, worker_type",
          )
          .eq("tenant_id", data.tenant_id)
          .in("party_id", partyIds);
        if (prErr) throw new Error(prErr.message);
        profiles = profileRows ?? [];
      }

      const byParty = new Map<string, any>(profiles.map((pr: any) => [pr.party_id, pr]));
      const deptIds: string[] = Array.from(new Set(profiles.map((p: any) => p.department_id).filter(Boolean)));
      const posIds: string[] = Array.from(new Set(profiles.map((p: any) => p.position_id).filter(Boolean)));
      const { deptName, posName } = await loadDeptPosNames(deps.supabaseAdmin, data.tenant_id, deptIds, posIds);

      return {
        rows: (parties ?? []).map((p: any) => {
          const prof = byParty.get(p.id);
          return {
            party_id: p.id,
            linked_user_id: p.linked_user_id ?? null,
            name_en: p.name_en,
            contact_email: p.contact_email,
            contact_phone: p.contact_phone,
            active: p.active,
            department_id: prof?.department_id ?? null,
            department: prof?.department_id ? (deptName.get(prof.department_id) ?? null) : null,
            position_id: prof?.position_id ?? null,
            position: prof?.position_id ? (posName.get(prof.position_id) ?? null) : null,
            manager_id: prof?.manager_id ?? null,
            employment_status: prof?.employment_status ?? null,
            hire_date: prof?.hire_date ?? null,
            termination_date: prof?.termination_date ?? null,
            worker_type: prof?.worker_type ?? null,
          };
        }),
      };
    });
}

export function createGetTeamMember(deps: TeamDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z.object({ tenant_id: z.string().uuid(), party_id: z.string().uuid() }).parse(i),
    )
    .handler(async ({ data, context }) => {
      await deps.assertCanReadTeam(data.tenant_id, (context as any).userId);

      const { data: party, error: pErr } = await deps.supabaseAdmin
        .from("parties")
        .select("id, linked_user_id, name_en, contact_email, contact_phone, active, is_employee")
        .eq("tenant_id", data.tenant_id)
        .eq("id", data.party_id)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!party || !party.is_employee) throw new Error("Team member not found");

      const { data: profile, error: prErr } = await deps.supabaseAdmin
        .from("employee_profiles")
        .select(
          "party_id, department_id, position_id, manager_id, employment_status, hire_date, termination_date, worker_type",
        )
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", data.party_id)
        .maybeSingle();
      if (prErr) throw new Error(prErr.message);

      const { deptName, posName } = await loadDeptPosNames(
        deps.supabaseAdmin,
        data.tenant_id,
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
    });
}

/**
 * Create-or-update a Team member. Accepts EITHER an existing `party_id`
 * (the common case for apps managing employees/contractors that have no
 * login — e.g. JoaOffice) OR a `linked_user_id` (the common case for
 * resolving/creating the Team record tied to an existing tenant login —
 * e.g. JoaSOP's Team page), OR neither for a brand-new Team member created
 * from scratch (name/contact fields required in that case).
 *
 * Always leaves both a `parties` row (is_employee = true) and a matching
 * `employee_profiles` row in place — this is the fix for the historical gap
 * where creating a party alone (e.g. via a Parties/Vendors admin screen)
 * never created the accompanying employee_profiles row.
 */
export function createUpsertTeamMember(deps: TeamDeps) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((i: unknown) =>
      z
        .object({
          tenant_id: z.string().uuid(),
          party_id: z.string().uuid().optional(),
          linked_user_id: z.string().uuid().optional(),
          name_en: z.string().min(1).max(200).optional(),
          contact_email: z.string().email().optional().nullable(),
          contact_phone: z.string().max(60).optional().nullable(),
          department_id: z.string().uuid().optional().nullable(),
          position_id: z.string().uuid().optional().nullable(),
          manager_id: z.string().uuid().optional().nullable(),
          employment_status: z.enum(EMPLOYMENT_STATUSES).optional(),
          hire_date: z.string().optional().nullable(),
          termination_date: z.string().optional().nullable(),
          worker_type: z.enum(WORKER_TYPES).default("employee"),
        })
        .parse(i),
    )
    .handler(async ({ data, context }) => {
      const callerId = (context as any).userId as string;
      await deps.assertCanWriteTeam(data.tenant_id, callerId);

      let partyId: string;
      let created = false;

      if (data.party_id) {
        partyId = data.party_id;
        const patch: Record<string, unknown> = {};
        if (data.name_en !== undefined) patch.name_en = data.name_en;
        if (data.contact_email !== undefined) patch.contact_email = data.contact_email;
        if (data.contact_phone !== undefined) patch.contact_phone = data.contact_phone;
        if (Object.keys(patch).length > 0) {
          const { error } = await deps.supabaseAdmin
            .from("parties")
            .update({ ...patch, is_employee: true })
            .eq("id", partyId)
            .eq("tenant_id", data.tenant_id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await deps.supabaseAdmin
            .from("parties")
            .update({ is_employee: true })
            .eq("id", partyId)
            .eq("tenant_id", data.tenant_id);
          if (error) throw new Error(error.message);
        }
      } else if (data.linked_user_id) {
        const { data: existingParty, error: findErr } = await deps.supabaseAdmin
          .from("parties")
          .select("id")
          .eq("tenant_id", data.tenant_id)
          .eq("linked_user_id", data.linked_user_id)
          .eq("is_employee", true)
          .maybeSingle();
        if (findErr) throw new Error(findErr.message);

        if (existingParty) {
          partyId = existingParty.id as string;
        } else {
          const { data: member, error: mErr } = await deps.supabaseAdmin
            .from("tenant_users")
            .select("display_name, email")
            .eq("tenant_id", data.tenant_id)
            .eq("user_id", data.linked_user_id)
            .maybeSingle();
          if (mErr) throw new Error(mErr.message);
          if (!member) throw new Error("This person is not a member of this workspace");

          const { data: newParty, error: insErr } = await deps.supabaseAdmin
            .from("parties")
            .insert({
              tenant_id: data.tenant_id,
              linked_user_id: data.linked_user_id,
              name_en: data.name_en ?? (member.display_name as string | null) ?? (member.email as string) ?? "Unnamed",
              contact_email: data.contact_email ?? (member.email as string | null) ?? null,
              is_employee: true,
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          partyId = newParty.id as string;
          created = true;
        }
      } else {
        if (!data.name_en) throw new Error("name_en is required to create a new team member");
        const { data: newParty, error: insErr } = await deps.supabaseAdmin
          .from("parties")
          .insert({
            tenant_id: data.tenant_id,
            name_en: data.name_en,
            contact_email: data.contact_email ?? null,
            contact_phone: data.contact_phone ?? null,
            is_employee: true,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(insErr.message);
        partyId = newParty.id as string;
        created = true;
      }

      const { data: existingProfile, error: findProfErr } = await deps.supabaseAdmin
        .from("employee_profiles")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .eq("party_id", partyId)
        .maybeSingle();
      if (findProfErr) throw new Error(findProfErr.message);

      const profilePatch = {
        department_id: data.department_id ?? null,
        position_id: data.position_id ?? null,
        manager_id: data.manager_id ?? null,
        worker_type: data.worker_type,
        ...(data.hire_date !== undefined ? { hire_date: data.hire_date } : {}),
        ...(data.termination_date !== undefined ? { termination_date: data.termination_date } : {}),
        ...(data.employment_status ? { employment_status: data.employment_status } : {}),
      };

      if (existingProfile) {
        const { error } = await deps.supabaseAdmin
          .from("employee_profiles")
          .update(profilePatch)
          .eq("id", existingProfile.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await deps.supabaseAdmin.from("employee_profiles").insert({
          tenant_id: data.tenant_id,
          party_id: partyId,
          employment_status: data.employment_status ?? "active",
          ...profilePatch,
        });
        if (error) throw new Error(error.message);
      }

      if (deps.onWrite) {
        await deps.onWrite({ tenantId: data.tenant_id, userId: callerId, partyId, created });
      }

      return { party_id: partyId, created };
    });
}
