-- ============================================================================
-- user_can_view_doc(): establish ONE canonical body across all 4 app repos.
--
-- Phase 0 of the "Shared Content Core" evaluation (2026-08-20). This
-- function is a single shared object on the one live Supabase project
-- (wxujbshqdlfstimectxh), but joabooks/joahr/joasop each independently
-- carry their own full-body CREATE OR REPLACE in their own migration
-- history, hand-written at different times without visibility into each
-- other's additions (joaoffice carried none at all). That produced real
-- drift: joasop's own copy (2026-07-11,
-- supabase/migrations/20260711064210_80db1fed-a5cb-4910-9b8e-47e845ad7bc6.sql)
-- still has `IF public.is_internal_staff(_tenant, _user) THEN RETURN true;
-- END IF;` as an unconditional first check -- is_internal_staff() is
-- app_code-UNSCOPED, so any joabooks/joaoffice finance/admin role grants
-- blanket read on every joasop.document regardless of security_level,
-- completely bypassing the sop_can_view_document() delegation that same
-- file's own comment says is there to enforce it. This was already fixed
-- in joabooks' own later history (this exact migration's body, unchanged
-- since 20260729000000_bill_pr_unification_phase8_fix_dangling_payment_requests_refs.sql)
-- but joasop's repo never picked up the fix -- if that file (or an
-- equivalent hand-written copy) is ever re-applied to the live DB, the hole
-- reopens. joahr's own copy (2026-07-15) is stale but not itself
-- vulnerable -- it just predates joabooks' 'party'/employee-compensation
-- branch, so re-applying it would silently widen W-4/W-9/compensation
-- attachment access back to "any joabooks staff."
--
-- This is joabooks' own copy of the identical body now also being added,
-- unchanged, to joahr/joasop/joaoffice's own migration folders in the same
-- pass -- so any future full replay of any one repo's migration history
-- converges on this same, current-correct definition rather than each
-- repo's own stale snapshot. THIS FILE'S BODY IS THE CANONICAL SOURCE for
-- this function going forward: when adding a new doc_kind branch here,
-- update all 4 repos in the same change, starting from this body, and
-- verify against the live DB (`select pg_get_functiondef('public.user_can_view_doc'::regproc)`)
-- rather than trusting any one repo's migration history in isolation --
-- that assumption is exactly what caused this drift.
-- ============================================================================

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
  ELSIF _doc_kind::text LIKE 'shared.%' THEN
    IF public.is_joabooks_staff(_tenant, _user)
       OR public.is_internal_staff_scoped(_tenant, _user, 'joaoffice') THEN
      RETURN true;
    END IF;
  ELSIF _doc_kind = 'party' AND public.is_team_member_party(_tenant, _doc_id) THEN
    IF public.can_view_employee_compensation(_tenant, _user) THEN RETURN true; END IF;
  ELSE
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

  RETURN false;
END
$$;

NOTIFY pgrst, 'reload schema';
