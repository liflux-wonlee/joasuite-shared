-- ============================================================================
-- Shared Content Core — schema foundation (STEP 4 of the ChatGPT architecture
-- prompt's execution process). Canonical source per the migration-ownership
-- decision in this effort's Phase 0 report: JoaBooks already owns
-- public.attachments/parties and has the deepest migration history of the
-- four app repos, so it stays canonical here too. This file (and every
-- future Content Core migration) gets pushed byte-identical into
-- joahr/joasop/joaoffice's own migration folders via core-vendor, the same
-- way user_can_view_doc()'s canonical sync worked.
--
-- Design decision worth calling out explicitly: content_relations.entity_type
-- and entity_id deliberately reuse the SAME value space as the existing
-- public.attachments.doc_kind/doc_id columns (e.g. entity_type='party',
-- entity_id=<parties.id>; entity_type='joahr.worker_document',
-- entity_id=<hr.worker_document_requirements.id>). That means a relation's
-- visibility can be computed by calling the already-unified, already-audited
-- public.user_can_view_doc() directly -- no separate content_access_scopes
-- table, no new per-app authorization rules to write and keep in sync. A
-- content item is visible if the caller can see ANY ONE of its relations via
-- the real, existing per-app dispatch for that entity_type/entity_id -- this
-- is exactly "relation != permission": adding a relation only grants
-- visibility through the access rules that already govern that specific
-- target record, never a blanket grant.
--
-- public.attachments itself is NOT modified. A Content-Core-native upload
-- that has no specific record to anchor to yet ("upload first, link later")
-- gets a fresh doc_kind='shared.content_item' / doc_id=<content_items.id>
-- attachments row -- gated by the same delegation function content_items
-- itself uses. A BACKFILLED existing attachment keeps its original
-- doc_kind/doc_id untouched; its first content_relations row just mirrors
-- that existing (doc_kind, doc_id) pair, so backfilled content's visibility
-- is governed identically by both the untouched attachments row and its
-- content_relations mirror.
-- ============================================================================

ALTER TYPE public.doc_kind ADD VALUE IF NOT EXISTS 'shared.content_item';

-- ── content_items ────────────────────────────────────────────────────────
-- The logical content object. content_type is deliberately just 'file' /
-- 'external_link' for now (per the prompt's own "do not overbuild future
-- types" guidance) -- adding a type later needs no migration, just a new
-- CHECK value and, if it needs its own fields, a nullable column.
CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'file' CHECK (content_type IN ('file', 'external_link')),
  title text,
  description text,
  document_date date,
  expiration_date date,
  source_app text NOT NULL,
  origin_entity_type text,
  origin_entity_id uuid,
  current_version_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX content_items_tenant_idx ON public.content_items(tenant_id);
CREATE INDEX content_items_origin_idx ON public.content_items(tenant_id, origin_entity_type, origin_entity_id)
  WHERE origin_entity_type IS NOT NULL;

-- ── content_versions ─────────────────────────────────────────────────────
-- The physical representation: either an existing public.attachments row
-- (never duplicated) or an external URL. A version must be one or the
-- other -- never neither, matching office.document_links' own
-- attachment-or-missing precedent for the same kind of "either/or" shape.
CREATE TABLE public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  version_label text,
  attachment_id uuid REFERENCES public.attachments(id) ON DELETE SET NULL,
  external_url text,
  file_name text,
  mime_type text,
  file_size bigint,
  sha256 text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_versions_file_or_link CHECK (attachment_id IS NOT NULL OR external_url IS NOT NULL)
);

CREATE INDEX content_versions_item_idx ON public.content_versions(content_item_id);

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.content_versions(id) ON DELETE SET NULL;

-- ── content_relations ────────────────────────────────────────────────────
-- Many-to-many. entity_type/entity_id are free validated text, not a rigid
-- enum -- adding a new app or entity type never requires a schema migration
-- here (per the prompt's explicit requirement), only a new doc_kind value
-- (already how every app extends its own attachment surface today).
CREATE TABLE public.content_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  app_code text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  relation_type text NOT NULL DEFAULT 'related',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, app_code, entity_type, entity_id, relation_type)
);

CREATE INDEX content_relations_item_idx ON public.content_relations(content_item_id);
CREATE INDEX content_relations_entity_idx ON public.content_relations(tenant_id, entity_type, entity_id);

-- ── Authorization: AND across namespaces present, OR within a namespace ──
-- via the existing, already-unified per-app dispatcher.
--
-- A naive "visible if ANY relation resolves visible" (plain OR across every
-- relation) has a real cross-app leak: if a JoaHR tax_identity_restricted
-- W-9 also gets a JoaBooks 'party' (vendor) relation, a JoaBooks-only
-- finance_manager with zero HR access would pass the party-side check
-- (ordinary is_joabooks_staff) and, under a plain OR, see the whole
-- content item -- including the underlying HR-restricted file. That is
-- exactly the leak Scenario C's "adding the JoaBooks relation must NOT
-- automatically grant JoaBooks access" warns against.
--
-- Fix: group relations by namespace (the same LIKE-prefix grouping
-- user_can_view_doc's own dispatch already uses -- joahr./joasop./
-- joaoffice./shared./else-is-joabooks-family), and require the caller to
-- pass at least one relation's check WITHIN EVERY namespace the item has a
-- relation in. Within one namespace, OR is still correct and desired (two
-- Bills in the same app: either being visible is enough, since they share
-- the same app's trust boundary) -- it's only ACROSS namespaces that must
-- be AND, so a viewer needs genuine access on every side the content has
-- been explicitly related into, not just one.
CREATE OR REPLACE FUNCTION public.user_can_view_content(_tenant uuid, _user uuid, _content_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
  _found boolean;
  _namespaces text[];
  _ns text;
  _ns_ok boolean;
  r record;
BEGIN
  SELECT created_by INTO _creator FROM public.content_items
   WHERE id = _content_item_id AND tenant_id = _tenant;
  GET DIAGNOSTICS _found = ROW_COUNT;
  IF NOT _found THEN RETURN false; END IF;
  IF _creator = _user THEN RETURN true; END IF;

  SELECT array_agg(DISTINCT
    CASE
      WHEN entity_type LIKE 'joahr.%' THEN 'joahr'
      WHEN entity_type LIKE 'joasop.%' THEN 'joasop'
      WHEN entity_type LIKE 'joaoffice.%' THEN 'joaoffice'
      WHEN entity_type LIKE 'shared.%' THEN 'shared'
      ELSE 'joabooks'
    END
  ) INTO _namespaces
  FROM public.content_relations
  WHERE content_item_id = _content_item_id AND tenant_id = _tenant;

  IF _namespaces IS NULL THEN RETURN false; END IF;

  FOREACH _ns IN ARRAY _namespaces LOOP
    _ns_ok := false;
    FOR r IN
      SELECT entity_type, entity_id FROM public.content_relations
       WHERE content_item_id = _content_item_id AND tenant_id = _tenant
         AND CASE
               WHEN entity_type LIKE 'joahr.%' THEN 'joahr'
               WHEN entity_type LIKE 'joasop.%' THEN 'joasop'
               WHEN entity_type LIKE 'joaoffice.%' THEN 'joaoffice'
               WHEN entity_type LIKE 'shared.%' THEN 'shared'
               ELSE 'joabooks'
             END = _ns
    LOOP
      BEGIN
        IF public.user_can_view_doc(_tenant, _user, r.entity_type::public.doc_kind, r.entity_id) THEN
          _ns_ok := true;
          EXIT;
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        -- entity_type isn't a known doc_kind value yet (e.g. a future
        -- app's own entity space not mirrored into doc_kind) -- skip this
        -- one relation, don't error the whole check.
        CONTINUE;
      END;
    END LOOP;
    IF NOT _ns_ok THEN RETURN false; END IF;
  END LOOP;

  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.user_can_view_content(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_view_content(uuid, uuid, uuid) TO authenticated, service_role;

-- ── Wire into the single existing dispatcher ─────────────────────────────
-- So public.attachments RLS (att_select/att_insert, already calling
-- user_can_view_doc directly) picks up 'shared.content_item' for free, with
-- no separate policy to maintain. Full body reproduced (not a diff) since
-- this is a CREATE OR REPLACE -- this becomes the new canonical body,
-- synced to joahr/joasop/joaoffice in the same pass as this file.
CREATE OR REPLACE FUNCTION public.user_can_view_doc(
  _tenant uuid,
  _user uuid,
  _doc_kind public.doc_kind,
  _doc_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _submitted_by uuid;
  _party_id uuid;
  _sec hr.document_security_level;
BEGIN
  IF _doc_kind::text LIKE 'joasop.%' THEN
    NULL;
  ELSIF _doc_kind::text LIKE 'joaoffice.%' THEN
    IF public.is_internal_staff_scoped(_tenant, _user, 'joaoffice') THEN RETURN true; END IF;
  ELSIF _doc_kind::text LIKE 'joahr.%' THEN
    NULL;
  ELSIF _doc_kind::text LIKE 'shared.%' AND _doc_kind::text != 'shared.content_item' THEN
    IF public.is_joabooks_staff(_tenant, _user)
       OR public.is_internal_staff_scoped(_tenant, _user, 'joaoffice') THEN
      RETURN true;
    END IF;
  ELSIF _doc_kind = 'party' AND public.is_team_member_party(_tenant, _doc_id) THEN
    IF public.can_view_employee_compensation(_tenant, _user) THEN RETURN true; END IF;
  ELSIF _doc_kind::text != 'shared.content_item' THEN
    IF public.is_joabooks_staff(_tenant, _user) THEN RETURN true; END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.approvals
     WHERE tenant_id = _tenant
       AND doc_kind = _doc_kind
       AND doc_id = _doc_id
       AND assigned_to = _user
  ) THEN
    RETURN true;
  END IF;

  IF _doc_kind = 'payment_request' THEN
    SELECT submitted_by, party_id
      INTO _submitted_by, _party_id
      FROM public.bills
     WHERE id = _doc_id;
    IF _submitted_by = _user THEN RETURN true; END IF;
    IF _party_id IS NOT NULL AND public.user_has_party_access(_party_id, _user) THEN
      RETURN true;
    END IF;
  END IF;

  IF _doc_kind = 'invoice' THEN
    SELECT party_id INTO _party_id
      FROM public.invoices
     WHERE id = _doc_id;
    IF _party_id IS NOT NULL AND public.user_has_party_access(_party_id, _user) THEN
      RETURN true;
    END IF;
  END IF;

  IF _doc_kind = 'joasop.document'::public.doc_kind THEN
    IF public.tenant_has_app(_tenant, 'joasop')
       AND public.sop_can_view_document(_tenant, _user, _doc_id) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF _doc_kind::text = 'joahr.worker_document' THEN
    IF NOT public.tenant_has_app(_tenant, 'joahr') THEN RETURN false; END IF;
    SELECT party_id, security_level
      INTO _party_id, _sec
      FROM hr.worker_document_requirements
     WHERE id = _doc_id AND tenant_id = _tenant;
    IF _party_id IS NULL THEN RETURN false; END IF;
    RETURN hr.can_view_worker_document(_tenant, _user, _party_id, _sec);
  END IF;

  IF _doc_kind = 'joabooks.vendor_bank_account'::public.doc_kind THEN
    SELECT vendor_id INTO _party_id
      FROM public.vendor_bank_accounts
     WHERE id = _doc_id AND tenant_id = _tenant;
    IF _party_id IS NOT NULL AND public.user_has_party_access(_party_id, _user) THEN
      RETURN true;
    END IF;
  END IF;

  IF _doc_kind::text = 'shared.content_item' THEN
    RETURN public.user_can_view_content(_tenant, _user, _doc_id);
  END IF;

  RETURN false;
END
$$;

-- Safe wrapper for RLS: content_relations.entity_type is free text (by
-- design -- new apps/entity types never need a schema change here), but
-- casting straight to public.doc_kind inside a bare RLS boolean expression
-- has no way to catch an invalid value -- one row with an entity_type that
-- isn't (yet) a doc_kind value would error out the whole query, not just
-- that row. This wraps the cast in a STABLE function so a bad value simply
-- resolves to "not visible" instead of breaking the read.
CREATE OR REPLACE FUNCTION public.user_can_view_content_relation_target(
  _tenant uuid, _user uuid, _entity_type text, _entity_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.user_can_view_doc(_tenant, _user, _entity_type::public.doc_kind, _entity_id);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END
$$;

REVOKE ALL ON FUNCTION public.user_can_view_content_relation_target(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_view_content_relation_target(uuid, uuid, text, uuid) TO authenticated, service_role;

-- ── RLS: content_items / content_versions / content_relations ───────────
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_relations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;
GRANT SELECT, INSERT ON public.content_versions TO authenticated;
GRANT ALL ON public.content_versions TO service_role;
GRANT SELECT, INSERT, DELETE ON public.content_relations TO authenticated;
GRANT ALL ON public.content_relations TO service_role;

CREATE POLICY content_items_select ON public.content_items FOR SELECT TO authenticated
  USING (public.user_can_view_content(tenant_id, auth.uid(), id));

CREATE POLICY content_items_insert ON public.content_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));

-- Updating a content_item (title/description/archived_at/current_version_id)
-- requires the same visibility a reader already needs -- there is no
-- separate "editor" tier in this foundational pass. Tightening this later
-- (e.g. only the uploader or an app-scoped role may archive) is additive.
CREATE POLICY content_items_update ON public.content_items FOR UPDATE TO authenticated
  USING (public.user_can_view_content(tenant_id, auth.uid(), id))
  WITH CHECK (public.user_can_view_content(tenant_id, auth.uid(), id));

CREATE POLICY content_versions_select ON public.content_versions FOR SELECT TO authenticated
  USING (public.user_can_view_content(tenant_id, auth.uid(), content_item_id));

CREATE POLICY content_versions_insert ON public.content_versions FOR INSERT TO authenticated
  WITH CHECK (public.user_can_view_content(tenant_id, auth.uid(), content_item_id));

-- A relation is readable if either side is visible: the content itself, or
-- the target record it points at (so "what else is this Bill linked to"
-- queries from the target-record side work without first proving content
-- visibility through a different relation).
CREATE POLICY content_relations_select ON public.content_relations FOR SELECT TO authenticated
  USING (
    public.user_can_view_content(tenant_id, auth.uid(), content_item_id)
    OR public.user_can_view_content_relation_target(tenant_id, auth.uid(), entity_type, entity_id)
  );

-- Linking (INSERT) and unlinking (DELETE) both require proving access to
-- BOTH sides -- the content itself AND the target record being linked to --
-- matching the prompt's canLink()/canUnlink() capability pair. Never lets a
-- relation be created into a record the caller can't already reach.
CREATE POLICY content_relations_insert ON public.content_relations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_can_view_content(tenant_id, auth.uid(), content_item_id)
    AND public.user_can_view_content_relation_target(tenant_id, auth.uid(), entity_type, entity_id)
  );

CREATE POLICY content_relations_delete ON public.content_relations FOR DELETE TO authenticated
  USING (
    public.user_can_view_content(tenant_id, auth.uid(), content_item_id)
    AND public.user_can_view_content_relation_target(tenant_id, auth.uid(), entity_type, entity_id)
  );

CREATE TRIGGER set_content_items_updated_at
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
