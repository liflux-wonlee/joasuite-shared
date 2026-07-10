import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronDown } from "lucide-react";
import { useJoaSuite } from "../context";

/**
 * Lets the user widen a screen (Dashboard, JoaSuite Home) from "this
 * organization" to any combination of the organizations they belong to.
 * Hidden entirely for users with only one membership — there's nothing to
 * scope. No elevated role is required: a user may always aggregate across
 * organizations they're already an active member of (the server still
 * re-verifies membership for every requested id — see
 * `resolveScopedTenantIds` in `./server`).
 */
export function OrgScopeToggle({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tenantIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const { useAuth, ui } = useJoaSuite();
  const { Button, Badge, Checkbox, Popover, PopoverContent, PopoverTrigger } = ui;
  const { memberships } = useAuth();
  const [open, setOpen] = useState(false);

  if (memberships.length <= 1) return null;

  const selected = new Set(value);
  const allSelected = memberships.every((m) => selected.has(m.tenant_id));

  const label = allSelected
    ? t("suite.org_scope.all_orgs", "All organizations ({{count}})", { count: memberships.length })
    : value.length <= 1
      ? t("suite.org_scope.this_org", "This organization")
      : t("suite.org_scope.n_selected", "{{count}} organizations selected", { count: value.length });

  const toggleOne = (tenantId: string) => {
    const next = new Set(selected);
    if (next.has(tenantId)) next.delete(tenantId);
    else next.add(tenantId);
    if (next.size === 0) return; // never allow an empty scope
    onChange(Array.from(next));
  };

  const toggleAll = () => {
    onChange(allSelected ? [memberships[0].tenant_id] : memberships.map((m) => m.tenant_id));
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
