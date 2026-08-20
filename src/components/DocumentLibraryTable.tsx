import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";

export type DocumentLibraryRow = {
  id: string;
  filename: string;
  /** Attachment kind (receipt/contract/w9/...), shown as a secondary tag. */
  kind?: string | null;
  /** Human label for the doc_kind this attachment belongs to, e.g. "Bill", "Invoice". Pass pre-translated. */
  docKindLabel: string;
  /** Display label for the record this file is attached to, e.g. a Bill number or vendor name. */
  linkedLabel?: string | null;
  /** Where clicking the linked-record cell should navigate, if anywhere. */
  linkedHref?: string | null;
  size?: number | null;
  createdAt?: string | null;
  uploadedByLabel?: string | null;
};

export type DocumentLibraryTableProps = {
  rows: DocumentLibraryRow[];
  loading?: boolean;
  formatSize?: (n: number | null | undefined) => string;
  formatDate?: (s: string | null | undefined) => string;
  /** Open the file for preview/download. */
  onOpen?: (row: DocumentLibraryRow) => void;
  /** Navigate to the row's linked record (linkedHref). */
  onNavigate?: (row: DocumentLibraryRow) => void;
  onDelete?: (row: DocumentLibraryRow) => void;
  /** Open the Related Records / Link-to-record flow for this row. */
  onLink?: (row: DocumentLibraryRow) => void;
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
 * Presentational cross-record file table -- the browse/search surface for
 * an app's "Document Library"-style page (as opposed to AttachmentsPanel,
 * which is scoped to one record). Every row's data and every action is
 * supplied by the host app (server-function calls, routing, deletion
 * confirmation) rather than this component reaching into app-specific
 * state, matching the plain presentational pattern already used by
 * FieldGroup/FieldRow rather than the fns-DI pattern used by pages like
 * TeamListPage -- this keeps adoption a zero-wiring drop-in for any app
 * that already calls JoaSuiteProvider, since it only touches the
 * ui.Button primitive every app already supplies.
 */
export function DocumentLibraryTable({
  rows,
  loading,
  formatSize = defaultFormatSize,
  formatDate = defaultFormatDate,
  onOpen,
  onNavigate,
  onDelete,
  onLink,
}: DocumentLibraryTableProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button } = ui;

  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{t("doc_library.col_type", "Type")}</th>
            <th className="px-4 py-2.5 font-medium">{t("doc_library.col_filename", "File")}</th>
            <th className="px-4 py-2.5 font-medium">{t("doc_library.col_linked", "Linked record")}</th>
            <th className="px-4 py-2.5 font-medium">{t("doc_library.col_uploaded", "Uploaded")}</th>
            <th className="px-4 py-2.5 font-medium">{t("doc_library.col_size", "Size")}</th>
            <th className="px-4 py-2.5 font-medium text-right">{t("doc_library.col_actions", "Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                {t("doc_library.loading", "Loading…")}
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                {t("doc_library.empty", "No documents yet.")}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{r.docKindLabel}</td>
                <td className="px-4 py-2.5 max-w-[240px]">
                  <button
                    type="button"
                    onClick={() => onOpen?.(r)}
                    className="truncate block text-left hover:text-primary hover:underline"
                    title={r.filename}
                  >
                    {r.filename}
                  </button>
                </td>
                <td className="px-4 py-2.5 max-w-[220px]">
                  {r.linkedHref ? (
                    <button
                      type="button"
                      onClick={() => onNavigate?.(r)}
                      className="truncate block text-left text-primary hover:underline"
                      title={r.linkedLabel ?? undefined}
                    >
                      {r.linkedLabel ?? "—"}
                    </button>
                  ) : (
                    <span className="truncate block text-muted-foreground" title={r.linkedLabel ?? undefined}>
                      {r.linkedLabel ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                  {formatDate(r.createdAt)}
                  {r.uploadedByLabel ? ` · ${r.uploadedByLabel}` : ""}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatSize(r.size)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {onOpen && (
                      <Button variant="ghost" size="sm" onClick={() => onOpen(r)}>
                        {t("doc_library.open", "Open")}
                      </Button>
                    )}
                    {onLink && (
                      <Button variant="ghost" size="sm" onClick={() => onLink(r)}>
                        {t("content_core.link_to_record", "Link to record")}
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(r)}>
                        {t("doc_library.delete", "Delete")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
