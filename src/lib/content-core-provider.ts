import type { ContentItem, ContentItemDetail, ContentSearchFilters, ContentVersion } from "./content-core-types";

/**
 * ContentProvider — the DI seam between the generic shared components and
 * one app's own local server functions. This IS the "Shared Content
 * Service" the Phase 2 prompt's Section 3 asks for: rather than a second,
 * heavier stateful service/class layered on top (which this package
 * deliberately has no precedent for -- see the deviation note below), it is
 * a plain interface an app implements once, in its own local
 * content-core.functions.ts-equivalent, and passes as a prop into whichever
 * shared components it uses. This matches the plain "presentational
 * component + injected provider prop" pattern already established by
 * ContentRelationProvider/DocumentLibraryTable/RelatedRecordsPanel, rather
 * than introducing a second DI mechanism alongside it.
 *
 * Every method here is a thin wrapper an app writes around its own local
 * `createServerFn(...)` calls -- per the suite-wide rule, this package
 * itself must never call `createServerFn()` (see any app's CLAUDE.md,
 * "`createServerFn()` must be called app-local, never inside
 * joasuite-shared"). This file only declares the shape; it contains no
 * implementation and touches no Supabase client, router, or app-specific
 * table.
 */
export type ContentProvider = {
  /** List content visible to the caller, optionally filtered. Server applies RLS -- never leaks inaccessible rows. */
  listContent(filters: ContentSearchFilters): Promise<ContentItem[]>;
  /** One content item plus its version history. Returns null if not found or not visible. */
  getContent(contentItemId: string): Promise<ContentItemDetail | null>;
  /** Wrap an existing attachment (already uploaded through the app's own upload flow) as a content item. */
  uploadFile(params: { attachmentId: string }): Promise<ContentItem>;
  /** Create a Content-Core-native external link. Implementations must reject non-http(s) schemes and never fetch the URL. */
  addExternalLink(params: { url: string; title: string; description?: string }): Promise<ContentItem>;
  /** Add a new version to an existing content item (file- or link-backed). */
  addVersion(params: { contentItemId: string; attachmentId?: string; externalUrl?: string; versionLabel?: string }): Promise<ContentVersion>;
  /** Archive tier only -- see docs/shared-content-core.md's delete-semantics table. Never deletes anything. */
  archiveContent(contentItemId: string, archived: boolean): Promise<void>;
};

/**
 * ContentAuthorizationProvider — UI-presentation-only capability checks
 * (show/hide a button). Optional everywhere it's used: per the prompt's own
 * Section 5 instruction ("the UI may use it for presentation, but server
 * enforcement remains authoritative — do not treat UI adapter checks as
 * security boundaries"), a shared component with no authorization provider
 * injected simply shows its controls and lets the server-side RLS/explicit
 * checks reject an unauthorized action -- it does not become insecure by
 * omission, only less polished (a button that then errors instead of one
 * that was never shown).
 */
export type ContentAuthorizationProvider = {
  canView(contentItemId: string): Promise<boolean>;
  canModify(contentItemId: string): Promise<boolean>;
  /**
   * Optional -- only an app that has actually built a Delete Permanently
   * tier (see docs/shared-content-core.md; JoaOffice's document-vault
   * cascade is the only one today) needs to supply this. A shared
   * component must never render a "Delete Permanently" control unless both
   * (a) the app passed an onDeletePermanently callback AND (b) this
   * resolves true -- see ArchiveContentAction's own contract.
   */
  canDeletePermanently?(contentItemId: string): Promise<boolean>;
};
