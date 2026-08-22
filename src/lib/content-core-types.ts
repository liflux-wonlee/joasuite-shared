/**
 * Shared Content Core — neutral data types.
 *
 * These mirror public.content_items / content_versions column-for-column
 * (camelCase, per this package's own convention — DB-facing app code stays
 * snake_case, shared-package-facing types are camelCase; see
 * content-core-provider.ts for where that mapping happens). No
 * ContentAccessScope type exists here — deliberately: see
 * joasuite-shared/docs/shared-content-core.md's "Deviation: no
 * content_access_scopes table" section. Visibility is derived at query
 * time from content_relations via user_can_view_content(), never stored as
 * a scope record, so there is nothing here for a type to represent.
 */

export type ContentType = "file" | "external_link";

export type ContentItem = {
  id: string;
  tenantId: string;
  contentType: ContentType;
  title: string | null;
  description: string | null;
  documentDate: string | null;
  expirationDate: string | null;
  sourceApp: string;
  originEntityType: string | null;
  originEntityId: string | null;
  currentVersionId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ContentVersion = {
  id: string;
  contentItemId: string;
  versionNumber: number;
  versionLabel: string | null;
  /** Set for content_type='file'. Points at the wrapped public.attachments row -- never duplicated. */
  attachmentId: string | null;
  /** Set for content_type='external_link'. http(s) only, never fetched server-side. */
  externalUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  sha256: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** Where a content item was first created from. Provenance only -- nothing checks this for authorization. */
export type ContentOrigin = {
  sourceApp: string;
  originEntityType: string | null;
  originEntityId: string | null;
};

/**
 * A ContentDetail-shaped bundle: one item with its versions and relations
 * loaded together, the shape ContentProvider.getContent() returns.
 */
export type ContentItemDetail = {
  item: ContentItem;
  versions: ContentVersion[];
};

/**
 * Reusable search/filter contract (Section 8 of the Phase 2 prompt). This is
 * a shape apps agree to accept in ContentProvider.listContent/searchContent
 * -- the actual filtering always happens server-side, inside each app's own
 * RLS-scoped query, so "do not leak results the user cannot access" is
 * satisfied by content_items_select RLS, not by anything in this package.
 */
export type ContentSearchFilters = {
  /** Matches against title / file name. */
  query?: string;
  contentType?: ContentType;
  documentDateFrom?: string;
  documentDateTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  createdBy?: string;
  sourceApp?: string;
  tags?: string[];
  /** Only content related to this specific record, if the app tracks it this way. */
  relatedEntityType?: string;
  relatedEntityId?: string;
  includeArchived?: boolean;
};
