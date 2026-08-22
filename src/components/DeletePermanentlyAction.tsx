import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";

export type DeletePermanentlyActionProps = {
  onDelete: () => Promise<void>;
  disabled?: boolean;
  size?: "sm" | "default";
};

/**
 * The most destructive of the three delete tiers. There is deliberately no
 * shared primitive for *performing* a permanent delete (see
 * docs/shared-content-core.md -- whether "permanently delete" also removes
 * the underlying attachment/storage object is an app-specific decision,
 * JoaOffice's document-vault cascade being the only one built so far) --
 * this component is only the confirm-and-invoke shell, identical in spirit
 * to ArchiveContentAction. The caller (the host app) decides whether to
 * render this at all: per Section 9 of the Phase 2 prompt, "permanent
 * delete must display only when the server says it is legal," which means
 * the app should only mount <DeletePermanentlyAction> after its own
 * ContentAuthorizationProvider.canDeletePermanently() (or equivalent)
 * resolved true -- this component does not call that check itself.
 */
export function DeletePermanentlyAction({ onDelete, disabled, size = "sm" }: DeletePermanentlyActionProps) {
  const { t } = useTranslation();
  const { ui } = useJoaSuite();
  const { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } = ui;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size={size} variant="destructive" disabled={disabled} onClick={() => setConfirmOpen(true)}>
        {t("content_core.delete_permanently", "Delete permanently")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("content_core.delete_permanently_confirm_title", "Delete permanently?")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "content_core.delete_permanently_confirm_body",
              "This cannot be undone. The file and every link to it will be removed.",
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              {t("content_core.cancel", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={busy}>
              {t("content_core.delete_permanently", "Delete permanently")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
