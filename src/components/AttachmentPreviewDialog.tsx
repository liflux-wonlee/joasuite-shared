import type { ReactNode } from "react";
import { useJoaSuite } from "../context";

export type AttachmentPreviewKind = "image" | "pdf" | "other";

/**
 * Best-effort file-kind guess from filename/mime, shared so every app's
 * attachment UI treats "what can we preview inline" the same way.
 */
export function guessAttachmentKind(filename: string, mime?: string | null): AttachmentPreviewKind {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export type AttachmentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename?: string;
  kind: AttachmentPreviewKind;
  /** Inline-viewable URL (signed URL or blob: URL) for image/pdf kinds. */
  previewUrl?: string;
  /** Download URL/href offered next to the filename. */
  downloadUrl?: string;
  downloadLabel?: string;
  /**
   * Render a PDF viewer for `previewUrl`. Falls back to a plain <iframe>
   * when omitted -- pass your app's own richer viewer (e.g. a react-pdf
   * component) to upgrade it without forking this dialog.
   */
  renderPdf?: (url: string) => ReactNode;
};

/**
 * Presentational image/PDF preview modal, factored out of JoaBooks'
 * AttachmentsPanel so JoaBooks' new Document Library page (and any future
 * per-app attachment UI) can reuse the same "click a file, see it inline"
 * behavior instead of re-implementing it. Uses only the ui.Dialog/Button
 * primitives every app already supplies via JoaSuiteProvider -- no new
 * UiAdapter fields, no server-function DI, so adopting this doesn't
 * require any change to an app's provider wiring.
 */
export function AttachmentPreviewDialog({
  open,
  onOpenChange,
  filename,
  kind,
  previewUrl,
  downloadUrl,
  downloadLabel = "Download",
  renderPdf,
}: AttachmentPreviewDialogProps) {
  const { ui } = useJoaSuite();
  const { Dialog, DialogContent, DialogHeader, DialogTitle, Button } = ui;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4 gap-3">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="truncate text-sm font-medium">{filename}</DialogTitle>
          {downloadUrl && (
            <a href={downloadUrl} download={filename}>
              <Button size="sm" variant="outline" type="button">
                {downloadLabel}
              </Button>
            </a>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30 rounded overflow-hidden flex items-center justify-center">
          {kind === "image" && previewUrl && (
            <img src={previewUrl} alt={filename} className="max-h-full max-w-full object-contain" />
          )}
          {kind === "pdf" && previewUrl && (
            renderPdf ? (
              renderPdf(previewUrl)
            ) : (
              <iframe src={previewUrl} title={filename} className="w-full h-full border-0" />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
