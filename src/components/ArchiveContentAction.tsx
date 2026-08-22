import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";

export type ArchiveContentActionProps = {
  archived: boolean;
  onArchive: () => Promise<void>;
  onUnarchive?: () => Promise<void>;
  disabled?: boolean;
  size?: "sm" | "default";
};

/**
 * The middle tier of the three delete semantics (Unlink < Archive < Delete
 * Permanently -- see docs/shared-content-core.md). Deliberately its own
 * component, never folded into a generic "Delete" button: Section 9 of the
 * Phase 2 prompt requires the UI to distinguish these, and a single
 * ambiguous Delete action is exactly the failure mode that requirement
 * exists to prevent. Confirms before acting since archiving changes what a
 * user sees in every default list, even though nothing is destroyed.
 */
export function ArchiveContentAction({ archived, onArchive, onUnarchive, disabled, size = "sm" }: ArchiveContentActionProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } = ui;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      if (archived) {
        await onUnarchive?.();
      } else {
        await onArchive();
      }
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  if (archived && !onUnarchive) return null;

  return (
    <>
      <Button size={size} variant="outline" disabled={disabled} onClick={() => setConfirmOpen(true)}>
        {archived ? t("content_core.unarchive", "Restore") : t("content_core.archive", "Archive")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {archived
                ? t("content_core.unarchive_confirm_title", "Restore this document?")
                : t("content_core.archive_confirm_title", "Archive this document?")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {archived
              ? t("content_core.unarchive_confirm_body", "It will appear in default lists again.")
              : t(
                  "content_core.archive_confirm_body",
                  "It will be hidden from default lists but not deleted — every link and version stays intact, and you can restore it anytime.",
                )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              {t("content_core.cancel", "Cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={busy}>
              {t("content_core.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
