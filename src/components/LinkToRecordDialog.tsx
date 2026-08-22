import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import type { ContentRelationProvider, RelationSearchResult } from "../lib/content-relations";

export type LinkToRecordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ContentRelationProvider;
  /** Called when the user picks a search result. Resolve to close the dialog on success. */
  onLink: (entityType: string, result: RelationSearchResult) => Promise<void>;
};

/**
 * "Link to record" — deliberately not "Assign" (per the JoaBooks UX rule:
 * a content item may relate to many records, many-to-many). Presentational
 * + a search callback; the host app owns what entity types exist and how
 * to search them via `provider`.
 */
export function LinkToRecordDialog({ open, onOpenChange, provider, onLink }: LinkToRecordDialogProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Dialog, DialogContent, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } = ui;

  const entityTypes = provider.getEntityTypes();
  const [entityType, setEntityType] = useState(entityTypes[0]?.entityType ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RelationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEntityType(entityTypes[0]?.entityType ?? "");
    setQuery("");
    setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !entityType) return;
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      provider
        .searchEntities(entityType, query)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, entityType, query, provider]);

  async function handlePick(result: RelationSearchResult) {
    setLinkingId(result.entityId);
    try {
      await onLink(entityType, result);
      onOpenChange(false);
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[92vw] flex flex-col gap-4 p-5 max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("content_core.link_to_record", "Link to record")}</DialogTitle>
        </DialogHeader>

        {entityTypes.length > 1 && (
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entityTypes.map((et) => (
                <SelectItem key={et.entityType} value={et.entityType}>
                  {et.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          autoFocus
          value={query}
          onChange={(e: any) => setQuery(e.target.value)}
          placeholder={t("content_core.search_records", "Search records…")}
        />

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md divide-y">
          {loading && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("common.loading", "Loading…")}
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("content_core.no_results", "No matching records.")}
            </div>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={r.entityId}
                type="button"
                disabled={linkingId === r.entityId}
                onClick={() => handlePick(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 disabled:opacity-50 flex flex-col gap-0.5"
              >
                <span className="text-sm font-medium">{r.label}</span>
                {r.sublabel && <span className="text-xs text-muted-foreground">{r.sublabel}</span>}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
