import type { ReactNode } from "react";

/**
 * Groups related fields under a subtitle with a light gray background —
 * shared visual convention for detail/edit pages across every JoaSuite app
 * (Team Member view/edit, JoaHR's Workforce overview, etc.). Purely
 * presentational, no data-fetching or app-specific logic.
 */
export function FieldGroup({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-muted/50 p-4 space-y-3 ${className ?? ""}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** A single label/value row for read-only display inside a FieldGroup. */
export function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? "—"}</dd>
    </div>
  );
}
