-- ============================================================================
-- Shared Content Core -- Phase 1 hardening (GPT's "PHASE 1 -- IMPLEMENT THE
-- SHARED CONTENT DATABASE FOUNDATION" prompt, 2026-08-21). Canonical source:
-- same as 20260820140000_content_core_schema_foundation.sql -- JoaBooks, per
-- the migration-ownership decision recorded in that file and in
-- joasuite-shared/docs/shared-content-core.md. Pushed byte-identical into
-- joahr/joasop/joaoffice via core-vendor.
--
-- One gap found while building the bulk backfill/indexer this Phase 1 prompt
-- asks for (Section 8-9): content_versions.attachment_id had no DB-level
-- uniqueness. getOrCreateContentItemForAttachment() only prevented a
-- duplicate wrap by checking-then-inserting in application code -- a real
-- but narrow race (two concurrent wrap attempts for the same attachment_id)
-- could still produce two content_items for one physical file. A partial
-- unique index closes that at the DB level and doubles as the lookup index
-- the backfill scan needs (there was none before this).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS content_versions_attachment_unique_idx
  ON public.content_versions (attachment_id)
  WHERE attachment_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
