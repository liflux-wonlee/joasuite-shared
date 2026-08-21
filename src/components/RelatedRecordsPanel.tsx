import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import { LinkToRecordDialog } from "./LinkToRecordDialog";
import type { ContentRelationProvider, ContentRelationRow, RelationSearchResult } from "../lib/content-relations";

export type RelatedRecordsPanelProps = {
  relations: ContentRelationRow[];
  /**
   * Optional -- per the Shared Content Core contract, an app that supplies
   * no relation provider still gets a fully working library, just without
   * relationship controls: this panel then renders existing relations
   * (label falls back to the raw entityType, since there's no provider to
   * resolve a display label/href from) but hides the "Link to record"
   * button entirely rather than rendering broken/no-op controls.
   */
  provider?: ContentRelationProvider;
  onLink: (entityType: string, result: RelationSearchResult) => Promise<void>;
  onUnlink?: (relation: ContentRelationRow) => Promise<void>;
  onNavigate?: (href: string) => void;
  loading?: boolean;
};

/**
 * "Related Records" -- the many-to-many relationship section (per the
 * JoaBooks UX rule: never "Assigned to"). Shows every current relation for
 * one content item and a button to add another. Bidirectional visibility
 * (a Bill showing which content items relate to IT) is the host app's own
 * page composing this same data from the other direction -- this component
 * only renders the content-item side.
 */
export function RelatedRecordsPanel({ relations, provider, onLink, onUnlink, onNavigate, loading }: RelatedRecordsPanelProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button } = ui;

  const [resolved, setResolved] = useState<Record<string, RelationSearchResult>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (relations.length === 0 || !provider) {
      setResolved({});
      return;
    }
    let cancelled = false;
    provider
      .resolveEntities(relations.map((r) => ({ entityType: r.entityType, entityId: r.entityId })))
      .then((res) => {
        if (!cancelled) setResolved(res);
      });
    return () => {
      cancelled = true;
    };
  }, [relations, provider]);

  async function handleUnlink(r: ContentRelationRow) {
    if (!onUnlink) return;
    setUnlinkingId(r.id);
    try {
      await onUnlink(r);
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t("content_core.related_records", "Related Records")}</h4>
        {provider && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            {t("content_core.link_to_record", "Link to record")}
          </Button>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">{t("common.loading", "Loading…")}</div>}

      {!loading && relations.length === 0 && (
        <div className="text-sm text-muted-foreground">
          {t("content_core.no_related_records", "Not linked to any record yet.")}
        </div>
      )}

      {!loading && relations.length > 0 && (
        <ul className="space-y-1">
          {relations.map((r) => {
            const key = `${r.entityType}:${r.entityId}`;
            const info = resolved[key];
            const href = provider?.getEntityHref(r.entityType, r.entityId) ?? null;
            return (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                {href && onNavigate ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(href)}
                    className="text-left text-primary hover:underline truncate"
                  >
                    {info?.label ?? r.entityType}
                    {info?.sublabel ? <span className="text-muted-foreground"> · {info.sublabel}</span> : null}
                  </button>
                ) : (
                  <span className="truncate">
                    {info?.label ?? r.entityType}
                    {info?.sublabel ? <span className="text-muted-foreground"> · {info.sublabel}</span> : null}
                  </span>
                )}
                {onUnlink && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={unlinkingId === r.id}
                    onClick={() => handleUnlink(r)}
                  >
                    {t("content_core.unlink", "Unlink")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {provider && (
        <LinkToRecordDialog open={dialogOpen} onOpenChange={setDialogOpen} provider={provider} onLink={onLink} />
      )}
    </div>
  );
}
