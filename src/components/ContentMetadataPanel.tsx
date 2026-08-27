import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoaSuite } from "../context";
import type { ContentItem } from "../lib/content-core-types";
import { ROLES_BY_APP, roleLabel } from "../constants";

export type ContentMetadataPatch = {
  title?: string | null;
  description?: string | null;
  author?: string | null;
  originLabel?: string | null;
  documentDate?: string | null;
  expirationDate?: string | null;
  keywords?: string[];
  documentType?: string | null;
  /** Empty = visible to everyone (default). Non-empty = restricted to holders of at least one listed role. */
  allowedRoles?: string[];
};

export type ContentMetadataPanelHandle = {
  /** Programmatically trigger the same save the panel's own Save button would. No-op if not currently editing. */
  save: () => Promise<void>;
};

export type ContentMetadataPanelProps = {
  item: ContentItem;
  /** Resolved "who actually added this" -- prefer this over item.createdBy; see content-core.functions.ts's resolveAddedBy for why they can differ. */
  addedByLabel?: string | null;
  formatDate?: (s: string | null | undefined) => string;
  /** Omit to render read-only (no Edit button). */
  onSave?: (patch: ContentMetadataPatch) => Promise<void>;
  /** Host-rendered tag editor (e.g. joabooks' TagPicker) -- kept as an injected slot since tag vocabulary/creation is app-specific, not something shared-ui owns. */
  renderTagsEditor?: () => React.ReactNode;
  /**
   * Controlled edit-mode toggle -- pass both to let a host-rendered toolbar
   * (e.g. a page-level Edit/Save/Cancel button group) drive the form
   * instead of the panel's own internal Edit/Save/Cancel buttons. Omit
   * both to keep the panel fully self-contained (its default behavior).
   */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** Hide the panel's own Edit/Save/Cancel buttons -- pass this alongside `editing`/`onEditingChange` when a host toolbar owns those actions instead. */
  hideActions?: boolean;
};

function buildForm(item: ContentItem): ContentMetadataPatch {
  return {
    title: item.title,
    description: item.description,
    author: item.author,
    originLabel: item.originLabel,
    documentDate: item.documentDate,
    expirationDate: item.expirationDate,
    keywords: item.keywords ?? [],
    documentType: item.documentType,
    allowedRoles: item.allowedRoles ?? [],
  };
}

/**
 * File Library redesign, Phase A/D: the "organizational memory" metadata a
 * content item carries beyond its raw file -- Author, Origin, Document/
 * Expiration dates, free-form Keywords, and (via the injected slot) Tags.
 * "Added by" + created date/time are intentionally NOT shown here -- the
 * host page renders those itself, right under the title (see joabooks'
 * app.documents.$id.tsx). Read-only by default; pass onSave to enable a
 * lightweight "Edit details" form (Section 10 of the File Library spec: do
 * not force the user to fill everything before saving -- every field here
 * stays optional).
 */
export const ContentMetadataPanel = forwardRef<ContentMetadataPanelHandle, ContentMetadataPanelProps>(
  function ContentMetadataPanel(
    { item, formatDate, onSave, renderTagsEditor, editing: editingProp, onEditingChange, hideActions }: ContentMetadataPanelProps,
    ref,
  ) {
    const { t } = useTranslation();
    const { ui } = useJoaSuite();
    const { Button, Input, Label, Textarea, Badge, Checkbox } = ui;

    const controlled = editingProp !== undefined;
    const [internalEditing, setInternalEditing] = useState(false);
    const editing = controlled ? editingProp : internalEditing;
    const setEditing = (v: boolean) => {
      if (controlled) onEditingChange?.(v);
      else setInternalEditing(v);
    };

    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<ContentMetadataPatch>(buildForm(item));
    const [keywordInput, setKeywordInput] = useState("");

    const fmt = formatDate ?? ((s: string | null | undefined) => s ?? "");

    // Roles selectable for restricting this item, scoped to its own
    // sourceApp -- owner/super_admin are deliberately excluded from the list
    // itself since they always bypass this check regardless (see
    // user_can_view_content()'s own comment), not because they're denied.
    const selectableRoles = (
      (ROLES_BY_APP as Record<string, string[]>)[item.sourceApp] ?? []
    ).filter((r) => r !== "owner" && r !== "super_admin");

    function startEdit() {
      setForm(buildForm(item));
      setKeywordInput("");
      setEditing(true);
    }

    function cancelEdit() {
      setEditing(false);
    }

    function toggleAllowedRole(role: string) {
      setForm((f) => {
        const cur = f.allowedRoles ?? [];
        return { ...f, allowedRoles: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] };
      });
    }

    function addKeyword() {
      const k = keywordInput.trim();
      if (!k) return;
      setForm((f) => ({ ...f, keywords: [...new Set([...(f.keywords ?? []), k])] }));
      setKeywordInput("");
    }

    function removeKeyword(k: string) {
      setForm((f) => ({ ...f, keywords: (f.keywords ?? []).filter((x) => x !== k) }));
    }

    async function handleSave() {
      if (!onSave || !editing) return;
      setBusy(true);
      try {
        await onSave(form);
        setEditing(false);
      } finally {
        setBusy(false);
      }
    }

    useImperativeHandle(ref, () => ({ save: handleSave }));

    // Controlled mode: (re)seed the form whenever edit mode is switched on
    // from outside, mirroring what startEdit() does for the uncontrolled case.
    const [seededFor, setSeededFor] = useState<boolean | null>(null);
    if (controlled && editing && seededFor !== editing) {
      setForm(buildForm(item));
      setSeededFor(editing);
    } else if (controlled && !editing && seededFor !== editing) {
      setSeededFor(editing);
    }

    const row = (label: string, value: React.ReactNode) =>
      value ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm">{value}</span>
        </div>
      ) : null;

    const visibilityLabel = {
      inbox: t("content_core.visibility_inbox", "Inbox"),
      normal: t("content_core.visibility_normal", "Library"),
      background: t("content_core.visibility_background", "Background (not shown in default browsing)"),
    }[item.libraryVisibility];

    return (
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{t("content_core.details", "Details")}</h4>
          {onSave && !editing && !hideActions && (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              {t("content_core.edit_details", "Edit details")}
            </Button>
          )}
        </div>

        {!editing && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {row(String(t("content_core.status", "Status")), visibilityLabel)}
            {row(
              String(t("content_core.visible_to", "Visible to")),
              item.allowedRoles?.length ? (
                <div className="flex flex-wrap gap-1">
                  {item.allowedRoles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {roleLabel(r)}
                    </Badge>
                  ))}
                </div>
              ) : (
                String(t("content_core.visible_to_everyone", "Everyone"))
              ),
            )}
            {row(String(t("content_core.document_type", "Document type")), item.documentType)}
            {row(String(t("content_core.author", "Author")), item.author)}
            {row(String(t("content_core.origin_label", "Origin")), item.originLabel)}
            {row(String(t("content_core.document_date", "Document date")), item.documentDate ? fmt(item.documentDate) : null)}
            {row(String(t("content_core.expiration_date", "Expires")), item.expirationDate ? fmt(item.expirationDate) : null)}
            {item.keywords?.length ? (
              <div className="col-span-2 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("content_core.keywords", "Keywords")}</span>
                <div className="flex flex-wrap gap-1">
                  {item.keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="text-xs">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {renderTagsEditor && (
              <div className="col-span-2 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("content_core.tags", "Tags")}</span>
                {renderTagsEditor()}
              </div>
            )}
          </div>
        )}

        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.title_label", "Title")}</Label>
                <Input
                  value={form.title ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={300}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.document_type", "Document type")}</Label>
                <Input
                  value={form.documentType ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                  placeholder={String(t("content_core.document_type_placeholder", "e.g. Invoice, Contract, Insurance Certificate"))}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.author", "Author")}</Label>
                <Input
                  value={form.author ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, author: e.target.value }))}
                  placeholder={String(t("content_core.author_placeholder", "Who produced this document?"))}
                  maxLength={300}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.origin_label", "Origin")}</Label>
                <Input
                  value={form.originLabel ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, originLabel: e.target.value }))}
                  placeholder={String(t("content_core.origin_label_placeholder", "e.g. Emailed by vendor"))}
                  maxLength={300}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.document_date", "Document date")}</Label>
                <Input
                  type="date"
                  value={form.documentDate ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, documentDate: e.target.value || null }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.expiration_date", "Expires")}</Label>
                <Input
                  type="date"
                  value={form.expirationDate ?? ""}
                  onChange={(e: any) => setForm((f) => ({ ...f, expirationDate: e.target.value || null }))}
                />
              </div>
            </div>
            {selectableRoles.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.visible_to", "Visible to")}</Label>
                <p className="text-xs text-muted-foreground">
                  {(form.allowedRoles ?? []).length === 0
                    ? t("content_core.visible_to_help_everyone", "Everyone in the workspace can see this item. Check roles below to restrict it.")
                    : t("content_core.visible_to_help_restricted", "Restricted to the checked roles below (Owner/Super Admin can always see everything).")}
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {selectableRoles.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={(form.allowedRoles ?? []).includes(r)}
                        onCheckedChange={() => toggleAllowedRole(r)}
                      />
                      {roleLabel(r)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{t("content_core.description_label", "Description")}</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e: any) => setForm((f) => ({ ...f, description: e.target.value }))}
                maxLength={2000}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("content_core.keywords", "Keywords")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("content_core.keywords_help", "Add any words you may use to find this later.")}
              </p>
              <div className="flex flex-wrap gap-1">
                {(form.keywords ?? []).map((k) => (
                  <Badge key={k} variant="secondary" className="gap-1 text-xs">
                    {k}
                    <button type="button" aria-label={`Remove ${k}`} onClick={() => removeKeyword(k)} className="ml-0.5">
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e: any) => setKeywordInput(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder={String(t("content_core.keywords_add_placeholder", "Type a word, press Enter"))}
                  maxLength={60}
                />
                <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
                  {t("content_core.add", "Add")}
                </Button>
              </div>
            </div>
            {renderTagsEditor && (
              <div className="space-y-1">
                <Label className="text-xs">{t("content_core.tags", "Tags")}</Label>
                {renderTagsEditor()}
              </div>
            )}
            {!hideActions && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={cancelEdit}>
                  {t("content_core.cancel", "Cancel")}
                </Button>
                <Button size="sm" disabled={busy} onClick={handleSave}>
                  {t("content_core.save", "Save")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
