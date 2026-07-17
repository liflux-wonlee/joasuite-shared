import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { useJoaSuite } from "../../context";

export type OrgChartPersonT = { party_id: string; name: string; worker_type?: string | null; avatar_url?: string | null };
export type OrgChartPositionT = { id: string; name: string; people: OrgChartPersonT[] };
export type OrgChartDepartmentT = {
  id: string;
  name: string;
  depth: number;
  positions: OrgChartPositionT[];
  children: OrgChartDepartmentT[];
};

export type OrgChartViewProps = {
  /** Fetch the tree via the shared `getOrgChartTree` server fn. Omit if passing `tree` directly. */
  tenantId?: string;
  /** Pre-fetched tree — use this to feed the chart from an app-local data layer (e.g. JoaHR's own Workforce module) instead of the shared server fn. */
  tree?: OrgChartDepartmentT[];
  isLoading?: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonCard({ person, positionName }: { person: OrgChartPersonT; positionName: string }) {
  return (
    <div className="org-chart-box org-chart-person">
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className="org-chart-avatar org-chart-avatar-img" />
      ) : (
        <div className="org-chart-avatar">{initials(person.name)}</div>
      )}
      <div className="org-chart-person-name">{person.name}</div>
      <div className="org-chart-person-position">{positionName}</div>
    </div>
  );
}

function PositionNode({ position, vacantLabel }: { position: OrgChartPositionT; vacantLabel: string }) {
  return (
    <li>
      <div className="org-chart-box org-chart-position">{position.name}</div>
      <ul>
        {position.people.length > 0 ? (
          position.people.map((person) => (
            <li key={person.party_id}>
              <PersonCard person={person} positionName={position.name} />
            </li>
          ))
        ) : (
          <li>
            <div className="org-chart-box org-chart-vacant">{vacantLabel}</div>
          </li>
        )}
      </ul>
    </li>
  );
}

function DepartmentNode({ dept, vacantLabel }: { dept: OrgChartDepartmentT; vacantLabel: string }) {
  const hasChildren = dept.children.length > 0 || dept.positions.length > 0;
  return (
    <li>
      <div className="org-chart-box org-chart-dept">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span>{dept.name}</span>
      </div>
      {hasChildren && (
        <ul>
          {dept.children.map((c) => (
            <DepartmentNode key={c.id} dept={c} vacantLabel={vacantLabel} />
          ))}
          {dept.positions.map((p) => (
            <PositionNode key={p.id} position={p} vacantLabel={vacantLabel} />
          ))}
        </ul>
      )}
    </li>
  );
}

const ORG_CHART_CSS = `
.org-chart-tree {
  display: inline-flex;
  list-style: none;
  margin: 0;
  padding: 0;
}
.org-chart-tree li {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 20px 12px 0 12px;
}
.org-chart-tree li ul {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 20px 0 0 0;
  position: relative;
}
.org-chart-tree li::before,
.org-chart-tree li::after {
  content: "";
  position: absolute;
  top: 0;
  right: 50%;
  width: 50%;
  height: 20px;
  border-top: 2px solid var(--border, #d4d4d8);
}
.org-chart-tree li::after {
  right: auto;
  left: 50%;
  border-left: 2px solid var(--border, #d4d4d8);
}
.org-chart-tree li:only-child::after,
.org-chart-tree li:only-child::before {
  display: none;
}
.org-chart-tree > li:first-child::before,
.org-chart-tree > li:last-child::after {
  border: 0 none;
}
.org-chart-tree li:last-child::before {
  border-right: 2px solid var(--border, #d4d4d8);
  border-radius: 0 6px 0 0;
}
.org-chart-tree li:first-child::after {
  border-radius: 6px 0 0 0;
}
.org-chart-tree li ul::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  border-left: 2px solid var(--border, #d4d4d8);
  width: 0;
  height: 20px;
}
.org-chart-box {
  border: 1px solid var(--border, #d4d4d8);
  border-radius: 8px;
  background: var(--card, #fff);
  padding: 8px 12px;
  font-size: 13px;
  white-space: nowrap;
}
.org-chart-dept {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  background: var(--muted, #f4f4f5);
}
.org-chart-position {
  font-weight: 500;
  color: var(--muted-foreground, #71717a);
}
.org-chart-vacant {
  color: var(--muted-foreground, #71717a);
  font-style: italic;
  border-style: dashed;
}
.org-chart-person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 96px;
  white-space: normal;
  text-align: center;
}
.org-chart-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--primary, #18181b);
  color: var(--primary-foreground, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}
.org-chart-avatar-img {
  object-fit: cover;
}
.org-chart-person-name {
  font-weight: 500;
}
.org-chart-person-position {
  font-size: 11px;
  color: var(--muted-foreground, #71717a);
}
`;

/**
 * Visual org chart: department tree with nested positions, each position
 * fanning out to the people currently holding it (photo/initials, name,
 * position). Pure CSS connector lines — no graph library dependency, so
 * this stays cheap to embed anywhere, including an app that feeds it a
 * locally-shaped tree instead of the shared `getOrgChartTree` fn.
 */
export function OrgChartView({ tenantId, tree, isLoading }: OrgChartViewProps) {
  const { t } = useTranslation();
  const { fns } = useJoaSuite();

  const q = useQuery({
    queryKey: ["org-chart-tree", tenantId],
    enabled: !!tenantId && !tree,
    queryFn: () => fns.getOrgChartTree({ tenant_id: tenantId! }),
  });

  const roots: OrgChartDepartmentT[] = tree ?? q.data?.roots ?? [];
  const loading = isLoading ?? (!tree && q.isLoading);
  const vacantLabel = t("team.org_chart_vacant", "Vacant");

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }
  if (roots.length === 0) {
    return (
      <div className="border rounded-lg p-10 text-center text-muted-foreground">
        {t("team.org_chart_empty", "No departments yet — add one to see the org chart.")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-6">
      <style>{ORG_CHART_CSS}</style>
      <ul className="org-chart-tree">
        {roots.map((d) => (
          <DepartmentNode key={d.id} dept={d} vacantLabel={vacantLabel} />
        ))}
      </ul>
    </div>
  );
}
