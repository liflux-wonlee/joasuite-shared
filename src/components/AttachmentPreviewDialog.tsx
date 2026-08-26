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
        {/*
          `relative` + `absolute inset-0` on each content wrapper (instead of
          `flex items-center justify-center` directly on this container) so
          the PDF branch gets a genuinely bounded box to scroll within.
          `align-items: center` on a flex container lets its child size to
          its own content instead of stretching to fill -- a multi-page PDF
          then grows past the visible area with no scrollbar (the *content*
          overflows, but the overflow-auto div wrapping it never becomes
          shorter than that content, so there's nothing to scroll *within*),
          and the top/bottom got clipped by this div's own `overflow-hidden`
          instead. `absolute inset-0` always resolves to a definite size
          from the `relative` ancestor regardless of flex alignment, so
          `overflow-auto` on the PDF wrapper has something real to scroll.
        */}
        <div className="flex-1 min-h-0 bg-muted/30 rounded overflow-hidden relative">
          {kind === "image" && previewUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img src={previewUrl} alt={filename} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {kind === "pdf" && previewUrl && (
            <div className="absolute inset-0 overflow-auto">
              {renderPdf ? (
                renderPdf(previewUrl)
              ) : (
                <iframe src={previewUrl} title={filename} className="w-full h-full border-0" />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
