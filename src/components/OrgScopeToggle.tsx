import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown } from "lucide-react";
import { useJoaSuite } from "../context";

/** Roles that may combine multiple organizations into one view by default.
 * `owner`/`super_admin` are suite-wide (see constants.ts ROLES_BY_APP) so
 * the core can safely gate on them; anything app-specific (e.g. JoaBooks'
 * `finance_manager`) is added by the caller via `allowedTenantIds`. */
const DEFAULT_PRIVILEGED_ROLES = ["owner", "super_admin"];

/**
 * Lets eligible users widen a screen (Dashboard, JoaSuite Home) from "this
 * organization" to a combination of the organizations they belong to.
 * Hidden entirely for everyone else, and for anyone with only one eligible
 * membership — there's nothing to scope.
 *
 * By default only `owner`/`super_admin` memberships are eligible. Pass
 * `allowedTenantIds` to widen eligibility with app-specific privileged
 * roles (e.g. JoaBooks includes `finance_manager`). This is a UI hint only
 * — the server independently re-checks role eligibility for every
 * requested tenant id (see `assertOrgScopeAccess` in `./server`).
 */
export function OrgScopeToggle({
  value,
  onChange,
  allowedTenantIds,
}: {
  value: string[];
  onChange: (tenantIds: string[]) => void;
  allowedTenantIds?: string[];
}) {
  const { t } = useTranslation();
  const { useAuth, ui } = useJoaSuite();
  const { Button, Badge, Checkbox, Popover, PopoverContent, PopoverTrigger } = ui;
  const { memberships } = useAuth();
  const [open, setOpen] = useState(false);

  const eligible = allowedTenantIds
    ? memberships.filter((m) => allowedTenantIds.includes(m.tenant_id))
    : memberships.filter((m) => m.roles.some((r) => DEFAULT_PRIVILEGED_ROLES.includes(r)));

  if (eligible.length <= 1) return null;

  const selected = new Set(value.filter((id) => eligible.some((m) => m.tenant_id === id)));
  if (selected.size === 0) selected.add(eligible[0].tenant_id);
  const allSelected = eligible.every((m) => selected.has(m.tenant_id));

  const label = allSelected
    ? t("suite.org_scope.all_orgs", "All organizations ({{count}})", { count: eligible.length })
    : selected.size <= 1
      ? t("suite.org_scope.this_org", "This organization")
      : t("suite.org_scope.n_selected", "{{count}} organizations selected", { count: selected.size });

  const toggleOne = (tenantId: string) => {
    const next = new Set(selected);
    if (next.has(tenantId)) next.delete(tenantId);
    else next.add(tenantId);
    if (next.size === 0) return; // never allow an empty scope
    onChange(Array.from(next));
  };

  const toggleAll = () => {
    onChange(allSelected ? [eligible[0].tenant_id] : eligible.map((m) => m.tenant_id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="h-3.5 w-3.5" />
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">
            {t("suite.org_scope.select_orgs", "Organizations")}
          </span>
          <button type="button" className="text-xs text-primary hover:underline" onClick={toggleAll}>
            {allSelected
              ? t("suite.org_scope.reset_to_current", "Reset to current")
              : t("suite.org_scope.select_all", "Select all")}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {memberships.map((m) => {
            const adminRole = m.roles.find((r) => r === "owner" || r === "super_admin");
            return (
              <label
                key={m.tenant_id}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.has(m.tenant_id)}
                  onCheckedChange={() => toggleOne(m.tenant_id)}
                />
                <span className="flex-1 truncate">{m.tenant_name ?? m.tenant_id}</span>
                {adminRole && (
                  <Badge variant="outline" className="text-[10px]">
                    {adminRole}
                  </Badge>
                )}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
