import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import type { ContentVersion } from "../lib/content-core-types";

export type ContentVersionsPanelProps = {
  versions: ContentVersion[];
  currentVersionId?: string | null;
  onOpen?: (version: ContentVersion) => void;
  /** Omit to hide the delete control entirely (e.g. a read-only view). */
  onDelete?: (version: ContentVersion) => void;
  formatSize?: (n: number | null | undefined) => string;
  formatDate?: (s: string | null | undefined) => string;
  /** Injectable section title (Section 7). */
  title?: string;
};

function defaultFormatSize(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function defaultFormatDate(s: string | null | undefined): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return s;
  }
}

/**
 * Version history for one content item. Works today even for apps with no
 * version-management UI of their own -- every existing attachment-backed
 * item already has exactly one version, so this just renders a
 * single-row list; nothing here assumes more than one version exists (see
 * docs/shared-content-core.md's "Version-ready design").
 */
export function ContentVersionsPanel({
  versions,
  currentVersionId,
  onOpen,
  onDelete,
  formatSize = defaultFormatSize,
  formatDate = defaultFormatDate,
  title,
}: ContentVersionsPanelProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button, Badge } = ui;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title ?? t("content_core.versions_title", "Versions")}</h4>
      {versions.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("content_core.no_versions", "No versions yet.")}</div>
      ) : (
        <ul className="space-y-1">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="min-w-0 flex items-center gap-2">
                <span className="truncate">{v.versionLabel ?? v.fileName ?? v.externalUrl ?? `v${v.versionNumber}`}</span>
                {v.id === currentVersionId && (
                  <Badge variant="secondary">{t("content_core.version_current", "Current")}</Badge>
                )}
                {v.fileSize != null && <span className="text-muted-foreground shrink-0">{formatSize(v.fileSize)}</span>}
                <span className="text-muted-foreground shrink-0">{formatDate(v.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onOpen && (
                  <Button size="sm" variant="ghost" onClick={() => onOpen(v)}>
                    {t("content_core.version_open", "Open")}
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(v)}>
                    {t("content_core.version_delete", "Delete")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
