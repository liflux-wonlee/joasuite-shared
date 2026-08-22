import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import { AddExternalLinkDialog } from "./AddExternalLinkDialog";

export type ContentUploaderProps = {
  /**
   * The host app owns the actual upload mechanics (storage bucket, signed
   * URL, wrapping the resulting attachment as a content item) -- this
   * component only captures the picked File and hands it off. Deliberately
   * NOT a full re-implementation of each app's own AttachmentsPanel-style
   * upload flow, which stays local per app since storage plumbing is
   * genuinely app-specific.
   */
  onUploadFile: (file: File) => Promise<void>;
  /** Omit to hide the "Add link" affordance entirely (e.g. an app with no external-link support). */
  onAddExternalLink?: (params: { url: string; title: string; description?: string }) => Promise<void>;
  accept?: string;
  uploadLabel?: string;
  linkLabel?: string;
  linkDialogTitle?: string;
  disabled?: boolean;
};

/**
 * Neutral "add content" shell: pick a file, or add an external link. No
 * label here is hardcoded to any app's own terminology for this feature
 * (e.g. JoaOffice's "Document Vault" vs JoaBooks' "Document Library") --
 * every visible string is either overridable via the props above or an
 * i18n key any app's own locale files can override.
 */
export function ContentUploader({
  onUploadFile,
  onAddExternalLink,
  accept,
  uploadLabel,
  linkLabel,
  linkDialogTitle,
  disabled,
}: ContentUploaderProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button } = ui;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  async function handleFileChange(e: any) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await onUploadFile(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
      <Button
        variant="outline"
        disabled={disabled || uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploadLabel ?? t("content_core.upload_file", "Upload file")}
      </Button>
      {onAddExternalLink && (
        <>
          <Button variant="outline" disabled={disabled} onClick={() => setLinkDialogOpen(true)}>
            {linkLabel ?? t("content_core.add_link", "Add link")}
          </Button>
          <AddExternalLinkDialog
            open={linkDialogOpen}
            onOpenChange={setLinkDialogOpen}
            onSubmit={onAddExternalLink}
            title={linkDialogTitle}
          />
        </>
      )}
    </div>
  );
}
