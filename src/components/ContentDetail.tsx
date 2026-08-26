import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import type { ContentItem, ContentVersion } from "../lib/content-core-types";
import type { ContentRelationProvider, ContentRelationRow, RelationSearchResult } from "../lib/content-relations";
import { ContentVersionsPanel } from "./ContentVersionsPanel";
import { RelatedRecordsPanel } from "./RelatedRecordsPanel";
import { ArchiveContentAction } from "./ArchiveContentAction";
import { DeletePermanentlyAction } from "./DeletePermanentlyAction";
import { ContentMetadataPanel, type ContentMetadataPatch } from "./ContentMetadataPanel";

export type ContentDetailProps = {
  item: ContentItem;
  versions: ContentVersion[];
  relations: ContentRelationRow[];
  /** Omit for an app with no relation provider -- Related Records renders read-only-ish with no "Link to record" control. */
  relationProvider?: ContentRelationProvider;
  onLinkRelation: (entityType: string, result: RelationSearchResult) => Promise<void>;
  onUnlinkRelation?: (relation: ContentRelationRow) => Promise<void>;
  onNavigateRelation?: (href: string) => void;
  onOpenVersion?: (version: ContentVersion) => void;
  onArchive?: () => Promise<void>;
  onUnarchive?: () => Promise<void>;
  /**
   * Only pass this once the host app's own authorization check has already
   * confirmed permanent delete is legal for this item (see
   * ContentAuthorizationProvider.canDeletePermanently) -- omitting it hides
   * the control entirely, matching Section 9's "must display only when the
   * server says it is legal."
   */
  onDeletePermanently?: () => Promise<void>;
  formatSize?: (n: number | null | undefined) => string;
  formatDate?: (s: string | null | undefined) => string;
  /** Injectable terminology (Section 7) -- e.g. JoaOffice may want "Vault entry" instead of the default. */
  labels?: {
    sourceAppLabel?: string;
    createdLabel?: string;
    archivedBadge?: string;
  };
  /**
   * File Library redesign (Phase A/B/D) -- all optional and additive, so
   * existing consumers are unaffected until they opt in.
   */
  /** Resolved "who actually added this" -- prefer over item.createdBy; see content-core.functions.ts's resolveAddedBy for why they can differ (a lazily-wrapped legacy attachment's created_by is whoever clicked "link", not the original uploader). */
  addedByLabel?: string | null;
  /** Enables the "Edit details" form (author/origin/dates/keywords/title/description) inside ContentMetadataPanel. Omit to keep the detail view read-only. */
  onSaveMetadata?: (patch: ContentMetadataPatch) => Promise<void>;
  /** Host-rendered tag editor (e.g. joabooks' TagPicker) -- kept as an injected slot since tag vocabulary/creation is app-specific. */
  renderTagsEditor?: () => React.ReactNode;
};

/**
 * Composed detail view for one content item: header metadata, versions,
 * related records, and the three delete-tier actions (Unlink lives inside
 * RelatedRecordsPanel per relation; Archive/Delete Permanently are
 * top-level item actions). This is the first "big" shared component built
 * on top of the smaller primitives (ContentVersionsPanel,
 * RelatedRecordsPanel, ArchiveContentAction, DeletePermanentlyAction) --
 * an app is free to use those smaller pieces directly instead of this
 * composition if its own detail page layout differs.
 */
export function ContentDetail({
  item,
  versions,
  relations,
  relationProvider,
  onLinkRelation,
  onUnlinkRelation,
  onNavigateRelation,
  onOpenVersion,
  onArchive,
  onUnarchive,
  onDeletePermanently,
  formatSize,
  formatDate,
  labels,
  addedByLabel,
  onSaveMetadata,
  renderTagsEditor,
}: ContentDetailProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Badge } = ui;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold truncate">{item.title ?? t("content_core.upload_file", "Untitled")}</h3>
          {item.archivedAt && <Badge variant="secondary">{labels?.archivedBadge ?? t("content_core.archived_badge", "Archived")}</Badge>}
        </div>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
        <p className="text-xs text-muted-foreground">
          {labels?.sourceAppLabel ?? t("content_core.source_app_label", "Source")}: {item.sourceApp}
          {" · "}
          {labels?.createdLabel ?? t("content_core.created_label", "Created")}: {formatDate ? formatDate(item.createdAt) : item.createdAt}
        </p>
      </div>

      {(onArchive || onDeletePermanently) && (
        <div className="flex items-center gap-2">
          {onArchive && (
            <ArchiveContentAction archived={!!item.archivedAt} onArchive={onArchive} onUnarchive={onUnarchive} />
          )}
          {onDeletePermanently && <DeletePermanentlyAction onDelete={onDeletePermanently} />}
        </div>
      )}

      <ContentMetadataPanel
        item={item}
        addedByLabel={addedByLabel}
        formatDate={formatDate}
        onSave={onSaveMetadata}
        renderTagsEditor={renderTagsEditor}
      />

      <ContentVersionsPanel
        versions={versions}
        currentVersionId={item.currentVersionId}
        onOpen={onOpenVersion}
        formatSize={formatSize}
        formatDate={formatDate}
      />

      <RelatedRecordsPanel
        relations={relations}
        provider={relationProvider}
        onLink={onLinkRelation}
        onUnlink={onUnlinkRelation}
        onNavigate={onNavigateRelation}
      />
    </div>
  );
}
