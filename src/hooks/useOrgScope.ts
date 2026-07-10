import { useEffect, useState } from "react";
import { useJoaSuite } from "../context";

/**
 * Local "which organizations am I looking at" state for a screen that wants
 * an org-scope selector (Dashboard, JoaSuite Home). Defaults to the user's
 * current active organization and follows it when they switch via the
 * workspace switcher — as long as they haven't deliberately widened the
 * selection to more than one org.
 */
export function useOrgScope(): [string[], (tenantIds: string[]) => void] {
  const { useAuth } = useJoaSuite();
  const { currentTenantId } = useAuth();
  const [scope, setScope] = useState<string[]>(currentTenantId ? [currentTenantId] : []);

  useEffect(() => {
    if (!currentTenantId) return;
    setScope((prev) => (prev.length <= 1 ? [currentTenantId] : prev));
  }, [currentTenantId]);

  return [scope, setScope];
}
