import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";

export type AddExternalLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: { url: string; title: string; description?: string }) => Promise<void>;
  /** Injectable dialog title (Section 7 -- never force "File Library"-style wording). */
  title?: string;
};

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/**
 * Client-side check only, for immediate feedback -- the real, authoritative
 * validation is server-side (see JoaBooks' createExternalLinkContent /
 * assertSafeExternalUrl). Never treat this as the security boundary.
 */
function isSafeUrl(raw: string): boolean {
  try {
    return ALLOWED_SCHEMES.has(new URL(raw).protocol);
  } catch {
    return false;
  }
}

/**
 * Add a Content-Core-native external link (Google Drive/Docs/Sheets,
 * Dropbox, SharePoint, or any other http(s) URL) -- no attachment, no
 * upload, nothing fetched server-side. Presentational: onSubmit is the
 * host app's own addExternalLink server-fn call.
 */
export function AddExternalLinkDialog({ open, onOpenChange, onSubmit, title }: AddExternalLinkDialogProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Textarea, Label, Button } = ui;

  const [url, setUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setLinkTitle("");
    setDescription("");
    setTouched(false);
  }, [open]);

  const urlValid = url.trim().length === 0 || isSafeUrl(url.trim());
  const canSubmit = url.trim().length > 0 && isSafeUrl(url.trim()) && linkTitle.trim().length > 0;

  async function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({ url: url.trim(), title: linkTitle.trim(), description: description.trim() || undefined });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t("content_core.add_link_title", "Add an external link")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("content_core.url_label", "URL")}</Label>
            <Input
              autoFocus
              value={url}
              onChange={(e: any) => setUrl(e.target.value)}
              placeholder={t("content_core.url_placeholder", "https://…")}
            />
            {touched && !urlValid && (
              <p className="text-xs text-destructive">{t("content_core.invalid_url", "Enter a valid http(s) URL.")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("content_core.title_label", "Title")}</Label>
            <Input value={linkTitle} onChange={(e: any) => setLinkTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("content_core.description_label", "Description")}</Label>
            <Textarea rows={2} value={description} onChange={(e: any) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("content_core.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={busy || (touched && !canSubmit)}>
            {t("content_core.add", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
