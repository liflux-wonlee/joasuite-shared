import type { ReactNode } from "react";

/**
 * Shared Content Core — relation-provider contract.
 *
 * A relation provider tells the generic Link-to-record UI what entity types
 * an app supports and how to search/resolve them, WITHOUT the shared
 * package ever knowing about Bills, Vendors, or any app-specific table.
 * Each app supplies its own provider; JoaOffice can supply none at all
 * (no financial linking controls exist there even if the tenant also has
 * JoaBooks -- see the "current-app capability" rule).
 *
 * entityType values are deliberately the same strings as this suite's
 * existing public.doc_kind enum (e.g. "party", "payment_request",
 * "joahr.worker_document") -- see the content_relations migration's own
 * comment for why: it lets content_relations rows be authorized by calling
 * the already-unified public.user_can_view_doc() directly.
 */

export type RelationEntityTypeOption = {
  /** Same value space as public.doc_kind, e.g. "party", "payment_request". */
  entityType: string;
  /** Display label, e.g. "Vendor", "Bill". Pass pre-translated. */
  label: string;
  /** Optional icon element for the entity-type picker. Rendered as-is, no default. */
  icon?: ReactNode;
};

export type RelationSearchResult = {
  entityId: string;
  /** Primary line, e.g. "BILL-2026-0182". */
  label: string;
  /** Secondary line with useful context, e.g. "Comcast · $328.42 · Aug 2026". */
  sublabel?: string;
};

export type ContentRelationProvider = {
  getEntityTypes(): RelationEntityTypeOption[];
  searchEntities(entityType: string, query: string): Promise<RelationSearchResult[]>;
  /**
   * Batch-resolve display info for already-linked entities (e.g. to render
   * "Related Records"), keyed by `${entityType}:${entityId}`. Only entries
   * the caller can actually see need to be present in the result.
   */
  resolveEntities(refs: Array<{ entityType: string; entityId: string }>): Promise<Record<string, RelationSearchResult>>;
  /** Where clicking a search result / an existing relation should navigate. Return null if there's no detail page. */
  getEntityHref(entityType: string, entityId: string): string | null;
  /**
   * UI-presentation hints only (e.g. disable/grey out one search result) --
   * the server (content_relations RLS + createContentRelation's explicit
   * user_can_view_doc check) is the real, authoritative gate regardless of
   * what these return. Omit either method to mean "always show the
   * control, let the server reject if it must" -- neither is required.
   */
  canLink?(entityType: string, entityId: string): Promise<boolean>;
  canUnlink?(entityType: string, entityId: string): Promise<boolean>;
};

export type ContentRelationRow = {
  id: string;
  contentItemId: string;
  appCode: string;
  entityType: string;
  entityId: string;
  relationType: string;
  createdAt: string;
};
