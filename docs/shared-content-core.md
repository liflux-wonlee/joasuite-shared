# Shared Content Core — architecture

Status: Phases 0-6 complete across all four app repos as of this writing.
Phase 1 (DB foundation) + Phase 2 (reusable UI layer, this package) +
Phase 3 (JoaOffice Document Vault fully migrated: tiered delete, external
links, Unlinked/Archived views) + Phase 4 (JoaBooks "File Library": 6
linkable entity types, Delete Permanently added — the gap called out
below no longer exists, bidirectional visibility on Bill/Invoice) +
Phase 5 (JoaHR↔JoaBooks W-9 cross-app pilot — built earlier, verified
working as designed; JoaSOP "create Policy from existing content"
adapter) + Phase 6 (future-app extension contract, Existing Content
Discovery foundation, duplicate-detection foundation, security test
suite, this document's final form). See "Phase 6" section near the
bottom for what's new in this pass and the project's final 13-point
report (also delivered directly to the user in chat).

This document is the canonical reference for anyone extending the Shared
Content Core. When in doubt about a design decision, this file — not
memory of an earlier chat, not one app repo's migration history in
isolation — is the source of truth. Update it in the same change as any
schema or authorization-dispatch change.

## Why this exists

Every JoaSuite app already had its own way of attaching a file to a record
(`public.attachments`, gated by `public.user_can_view_doc()`). What was
missing was a way to attach the *same* file/link to records in more than
one place, or to more than one app, without duplicating the upload — e.g.
a worker's W-9 (JoaHR) is the same document as that person's vendor W-9 on
file in JoaBooks; a JoaOffice asset's warranty PDF might also be worth
linking from the JoaBooks bill that paid for it. The Shared Content Core
adds a many-to-many relation layer on top of the existing attachment
mechanism, without replacing it.

## Table responsibilities

| Table | Responsibility |
|---|---|
| `public.content_items` | The logical content object (a thing someone would call "this document" or "this link"). Title, description, dates, archive flag, which app it originated in. |
| `public.content_versions` | The physical representation of one point-in-time state of a content item: either an existing `public.attachments` row (`attachment_id`) or an external URL (`external_url`) — never both empty. `content_items.current_version_id` points at whichever version is "current." Multiple versions per item is supported by the schema today even though no app exposes version-management UI yet (see "Version-ready design" below). |
| `public.content_relations` | The many-to-many bridge: which record(s) in which app(s) this content item is linked to. `entity_type`/`entity_id` deliberately reuse the exact same value space as `public.attachments.doc_kind`/`doc_id` (see "Origin vs relation vs permission" below) — this is *not* a new addressing scheme apps have to learn. |
| `public.content_access_scopes` | **Does not exist.** GPT's original proposal called for a fourth table dedicated to access scopes. This repo deliberately did not build it — see "Deviation: no `content_access_scopes` table" below for why and what stands in for it. |

## Origin vs relation vs permission

These three concepts are easy to conflate; keep them separate:

- **Origin** (`content_items.origin_entity_type`/`origin_entity_id`,
  `source_app`): where this content item was first created from. Set once,
  never changes. Informational/provenance only — nothing checks it for
  authorization.
- **Relation** (`content_relations` rows): which record(s) this content is
  *currently* linked to, across any number of apps. Many-to-many, can grow
  or shrink over the item's life (`linkContentToRecord`/
  `unlinkContentFromRecord`). A relation is a pointer, not a grant.
- **Permission** (`user_can_view_content()`/`user_can_view_doc()`): derived
  at query time from the current set of relations, never stored directly.
  Adding a relation only grants visibility through the access rules that
  already govern that specific target record — never a blanket grant. See
  "Authorization dispatch" below for exactly how this is computed.

## Migration ownership

**JoaBooks is the single source-of-truth repo for every Shared Content
Core schema migration.** This was decided in the Phase 0 report because
JoaBooks already owned `public.attachments`/`public.parties` and had the
deepest, most battle-tested migration history of the four app repos
(confirmed again by the `user_can_view_doc()` drift incident, where
JoaBooks' copy was the one every other repo's drifted/vulnerable copy had
to be reconciled against).

Rule going forward: **write a new Content Core migration file in JoaBooks
only.** Do not hand-author an equivalent migration independently in
joahr/joasop/joaoffice — that is exactly the pattern that produced the
`user_can_view_doc()` drift (three repos independently `CREATE OR
REPLACE`-ing the same function with no visibility into each other's
changes, one of them shipping a live security hole as a result). Instead:

1. Write and land the migration in JoaBooks under `supabase/migrations/`.
2. Copy the file **byte-identical**, same filename, into
   `joahr/joasop/joaoffice`'s own `supabase/migrations/` directories. All
   four repos share one physical Supabase project
   (`wxujbshqdlfstimectxh`), so only one of them needs to actually *apply*
   it — but every repo's migration history should still contain the file,
   so a full replay of any one repo's history converges on the same
   schema.
3. Add the filename to `joasuite-shared/core-vendor/manifest.txt`'s
   "Shared public-schema SQL migrations" section and copy it into
   `core-vendor/core/supabase/migrations/` too, so `pull-from-core.sh`
   picks it up for any future puller. This is the same `core-vendor`
   push/pull mechanism already used for shared `.ts` files
   (`recurring-v2.functions.ts` etc.) — it was confirmed path-agnostic and
   extended to track `.sql` files during Phase 0, no tooling change
   needed.
4. As always in this suite, **paste the raw SQL into the chat response**
   for the user to run in the Supabase SQL Editor — a committed migration
   file is not proof the live DB changed (see any app repo's own
   "DB migrations in this repo" CLAUDE.md section).

App-specific tables that merely *reference* Content Core (e.g. JoaOffice's
`office.document_links.content_item_id`) stay owned by their own app repo
— only the `public.content_items`/`content_versions`/`content_relations`
tables themselves, and the shared functions that dispatch on them
(`user_can_view_doc()`, `user_can_view_content()`,
`user_can_view_content_relation_target()`), are JoaBooks-canonical.

## Content types: files vs. external links

A `content_item` supports two backing kinds, both living in
`content_versions`:

- **File**, `attachment_id` set: wraps an *existing* `public.attachments`
  row. The attachment is never duplicated, moved, or re-uploaded — the
  content_version just points at it. This is how every existing app
  attachment becomes Content-Core-visible (see "Backfill" below).
- **External link**, `external_url` set: a URL to Google Drive/Docs/
  Sheets, Dropbox, SharePoint, or any other HTTPS document, entered
  directly by a user (`createExternalLinkContent`, JoaBooks
  `content-core.functions.ts`). The URL is validated (scheme must be
  `http:`/`https:` — `javascript:`/`data:`/`file:`/etc. are rejected
  before the row is ever written) and stored as-is. **The server never
  fetches the URL.** No preview, no metadata scrape, no duplication into
  storage — this is a deliberate, permanent constraint, not a
  not-yet-implemented feature, because server-side fetching of a
  user-supplied URL is an SSRF vector.

## Version-ready design

An existing attachment becomes:

```
content_item  (title = attachment.filename, origin = attachment's own doc_kind/doc_id)
  └─ content_version #1  →  attachment_id = <the existing attachments row>
```

`content_versions.version_number` and `version_label` exist today; no app
UI lets a user upload a *second* version of an existing content item yet.
That is fine by design — `content_items.current_version_id` already points
at a specific version row rather than assuming "the only version," so
adding version-management UI later is purely additive: insert a new
`content_versions` row, update `current_version_id`, done. No migration,
no redesign of the relation or authorization layers.

## RLS and security

Every new table has RLS enabled with no exceptions. Summary (full policy
SQL is in `20260820140000_content_core_schema_foundation.sql`):

- `content_items`: select/update require `user_can_view_content()`; insert
  requires `created_by = auth.uid()` and tenant membership.
- `content_versions`: select/insert require `user_can_view_content()` on
  the parent item.
- `content_relations`: select requires visibility on *either* side (the
  content or the target record — so "what else is this Bill linked to"
  works from the target-record side too); insert/delete require proving
  access to **both** sides, matching the proposal's `canLink()`/
  `canUnlink()` capability pair. A relation can never be created into a
  record the caller can't already reach.

None of this is enforced only in the frontend — every check above is a
Postgres RLS policy or a `SECURITY DEFINER` function called from one, so
it holds even against a direct API call bypassing the UI entirely. The
server-side `content-core.functions.ts` handlers additionally call
`user_can_view_doc`/`user_can_view_content` explicitly before any
`service_role`-privileged write (service_role bypasses RLS, so the RLS
policies alone do not gate those handlers — the explicit RPC checks do;
see "Security pattern: service-role writes must be role-gated" in every
app's CLAUDE.md for why this matters).

### The cross-app leak this design specifically defends against

A naive "content is visible if ANY ONE of its relations resolves visible"
(a plain `OR` across every relation row) has a real leak: if a JoaHR
`tax_identity_restricted` W-9 also carries an ordinary JoaBooks `party`
(vendor) relation, a JoaBooks-only `finance_manager` with zero HR access
would pass the party-side check (plain `is_joabooks_staff`) and, under a
plain OR, see the whole content item — including the underlying
HR-restricted file. That is precisely what the JoaHR↔JoaBooks W-9 pilot
scenario warns against: **adding a JoaBooks relation must never
automatically grant JoaBooks-side access to HR-restricted content.**

`user_can_view_content()` avoids this by grouping a content item's
relations into namespaces (`joahr.*`/`joasop.*`/`joaoffice.*`/`shared.*`/
else-is-joabooks, the same prefix grouping `user_can_view_doc()`'s own
dispatch already uses) and requiring the caller to pass the check within
**every** namespace the item has a relation in (AND across namespaces),
while still allowing OR **within** one namespace (two Bills in the same
app — either being visible is enough, since they share one trust
boundary). Confirmed verified: this is a self-caught fix, not part of the
original schema draft — see the commit history around
`content_core_schema_foundation.sql` for the before/after.

## Authorization dispatch

The Shared Content Core layer contains **zero** hardcoded role checks like
`if role === 'finance_manager'`. `user_can_view_content()` never inspects
a role directly — it delegates every relation's check to
`user_can_view_doc()`, which dispatches purely by `entity_type` (== the
existing `doc_kind` value space) to whichever per-app function already
owns that decision:

- `joahr.*` → HR's own `hr.can_view_worker_document()` (security-level
  aware).
- `joasop.*` → `public.sop_can_view_document()`.
- `joaoffice.*` → `public.is_internal_staff_scoped(tenant, user,
  'joaoffice')`.
- `party`/`payment_request`/`invoice`/etc. → JoaBooks' own existing
  per-doc-kind logic (`user_has_party_access`, `bills.submitted_by`, ...).

Adding a new app or entity type means adding a new `LIKE 'newapp.%'`
branch (or a specific `_doc_kind = '...'` branch) to `user_can_view_doc()`
that calls into that app's own authorization function — never adding
role-name logic to the Content Core tables/functions themselves. This is
what Section 6 of the Phase 1 prompt calls an "authorization-dispatch
pattern"; it already existed for `public.attachments` before Content Core
was built, and Content Core simply reuses it rather than inventing a
second one.

## Application integration contract

An app integrates with Content Core in two, independently optional,
layers:

1. **Data layer** (required to have any Content-Core-visible data at all):
   wrap the app's existing attachments through `content_items`/
   `content_versions`, and record at least one `content_relations` row per
   item (see `getOrCreateContentItemForAttachment`/`wrapOne` in JoaBooks,
   or JoaOffice's `wrapAttachmentAsContentItem` in
   `document-vault.functions.ts`, or the JoaHR pilot's
   `linkWorkerDocumentToJoaBooksVendor`). This can be done lazily (wrap on
   first cross-link) or eagerly (bulk backfill, see below) — both
   converge on the same result and are safe to mix.
2. **UI layer** (optional — JoaBooks and JoaHR have this, JoaOffice and
   JoaSOP deliberately don't): `ContentRelationProvider`
   (`joasuite-shared/src/lib/content-relations.ts`) —
   `getEntityTypes()`/`searchEntities()`/`resolveEntities()`/
   `getEntityHref()` — lets `LinkToRecordDialog`/`RelatedRecordsPanel`
   (also in `joasuite-shared`) offer a "link this to a record" picker
   without those shared components knowing anything about any specific
   app's entities. Per GPT's "current-app capability" rule, an app only
   implements the provider methods for entity types **it itself** can
   search/display. As of Phase 6: JoaBooks implements a full 6-entity-type
   provider (`party`/`payment_request`/`invoice`/`manual_transaction`/
   `transaction`/`shared.recurring_occurrence`, all ground-truthed against
   real tables — see "Future App Integration Contract" below for how that
   list was decided). JoaOffice supplies **no** provider at all — no
   JoaBooks/JoaHR/JoaSOP linking controls ever appear inside JoaOffice,
   even on a tenant subscribed to every app. JoaSOP is consumer-only (see
   "JoaSOP: consumer-only integration" above) — it never implements
   `ContentRelationProvider` either, since it never offers itself as a
   link target. JoaHR doesn't implement the full provider/UI-kit pattern
   at all; its one cross-app flow (`linkWorkerDocumentToJoaBooksVendor`)
   is a single narrow, purpose-built server action, not a generic picker.

**`createServerFn()` must always be called app-local** — this is not
specific to Content Core, it's a suite-wide rule (see any app's CLAUDE.md,
"`createServerFn()` must be called app-local, never inside
joasuite-shared"). Every app that needs Content Core data access
(`content-core.functions.ts`-equivalent) writes its own local
`createServerFn(...)` calls; `joasuite-shared` may only export plain
helpers/types that do not themselves wrap `createServerFn()` (e.g. the
`ContentRelationProvider` *type*, or a validation helper like
`assertSafeExternalUrl` if it's ever promoted to shared — not yet done,
it lives in JoaBooks only today since JoaBooks is the only app with a
Document Library UI to call it from).

## Safe delete semantics

Three tiers, from least to most destructive:

| Tier | What happens | Primitive |
|---|---|---|
| **Unlink** | Remove one `content_relations` row. The content item, its versions, and every *other* relation survive untouched. | `deleteContentRelation` (JoaBooks), or JoaOffice's `deleteDocumentLink` with `deleteAttachmentToo: false` |
| **Archive** | Set `content_items.archived_at`. The item stops appearing in default listings; every relation, version, and the underlying attachment/file are left completely intact — this is a visibility flag, not a data-removal operation. | `archiveContent` (JoaBooks) |
| **Delete Permanently** | Cascade-delete the content item's relations → versions → (app-specific: optionally the underlying attachment + storage object too). | No single shared primitive by design — whether "permanently delete" also deletes the underlying attachment is an app-specific decision. JoaOffice's `deleteDocumentLink({ deleteAttachmentToo: true })` (`document-vault.functions.ts`'s `deleteContentItemCascade`) and JoaBooks' `deleteContentItemPermanently` (`content-core.functions.ts`, added Phase 4) both implement this tier now. |

**Update (Phase 4):** JoaBooks now has its own `deleteContentItemPermanently`
in `content-core.functions.ts` — File Library's Delete Permanently action.
Unlike JoaOffice's cascade, it additionally refuses (throws, rather than
proceeding) if the `content_relations` count for that item is greater than
one, i.e. if it's linked from more than the one record the caller is
deleting it from — forcing Unlink instead in that case. This extra check
is JoaBooks-specific, not (yet) promoted into a shared primitive; a third
app building this tier should decide independently whether it wants the
same multi-relation guard or JoaOffice's simpler unconditional cascade.

## App adapter contract

Each app's local `content-core.functions.ts`-equivalent owns:

- Its own `ENTITY_TYPES` list (the `entity_type` values that app's own
  records use — always identical to that app's existing `doc_kind` set,
  never invented fresh).
- `searchContentRelationEntities`/`resolveContentRelationEntities` (or
  equivalent) — implements `ContentRelationProvider` for that app's own
  entity types only.
- Whatever subset of `createExternalLinkContent`/`archiveContent`/
  `checkCanViewContent`/`listContentRelations`/`createContentRelation`/
  `deleteContentRelation` that app's own UI actually needs. JoaBooks'
  copy in `src/lib/content-core.functions.ts` is the reference
  implementation — copy its shape, not necessarily every function, when
  building a new app's adapter.

The shared layer (schema + `user_can_view_content()` +
`user_can_view_content_relation_target()`) never contains JoaBooks-,
JoaHR-, JoaSOP-, or JoaOffice-specific entity queries — those always live
in that app's own adapter file, per Section 7 of the Phase 1 prompt.

## How existing attachments remain supported

`public.attachments` is **not modified or deprecated** by any of this.
Every existing attachment keeps working exactly as before, through
exactly the same RLS/`user_can_view_doc()` path, whether or not it has
ever been wrapped into a `content_item`. Wrapping is purely additive:

- **Lazy backfill**: the first time a user tries to link an existing
  attachment to a second record, `getOrCreateContentItemForAttachment`
  wraps it on the spot (idempotent — checks `content_versions.attachment_id`
  first, and a `UNIQUE` partial index on that column is the DB-level
  backstop against a race).
- **Eager/bulk backfill**: `previewContentBackfill`/`runContentBackfill`
  (JoaBooks, `content-core-backfill.functions.ts`) scan `public.attachments`
  for a tenant page by page and wrap everything not yet wrapped, deriving
  each attachment's `app_code`/`source_app` from its own `doc_kind` prefix
  (so a JoaHR attachment gets wrapped as JoaHR-owned content, not
  relabeled JoaBooks). See "Backfill" below for the full contract.

A content item created by either path is **exactly as restricted after
wrapping as the original attachment was before** — the mirrored
`content_relations` row reuses that attachment's own untouched
`(doc_kind, doc_id)`, so `user_can_view_content()` re-derives visibility
through the same `user_can_view_doc()` check the raw attachment always
had. Wrapping never widens access.

## Backfill

`previewContentBackfill(tenant_id, offset?, limit?)` — dry run. Scans one
page of `public.attachments` (default 200 rows, max 1000), reports counts
grouped by `doc_kind`: `scanned` / `already_wrapped` / `would_wrap` /
`invalid` (currently only the permanently-dead `doc_kind = 'bill'` value,
see JoaBooks' CLAUDE.md's Bill/PR unification writeup), plus `next_offset`
for paging through a tenant with more attachments than one page. Writes
nothing.

`runContentBackfill(tenant_id, offset?, limit?)` — same scan, but actually
wraps every not-yet-wrapped, non-invalid attachment via the same logic the
lazy path uses. Returns `inserted` / `skipped_already_wrapped` / `invalid`
/ `errors: [{attachment_id, doc_kind, error}]` (per-item errors don't abort
the page — they're collected and returned) and
`content_items_count_before`/`content_items_count_after` for the tenant.
Idempotent: re-running any page (including one already fully processed)
only ever inserts what is still missing — safe to re-run after a partial
failure or simply to catch attachments created since the last run.

Both are gated to **owner or super_admin only** (suite-wide roles,
`_app_code: null` passed to `has_role` so an app-scoped `admin` role can
never match — see `content-core-backfill.functions.ts`'s own comment for
why `_app_code IS NULL` in the `has_role` SQL function means this
correctly excludes app-scoped roles even from a matching app). This is
tighter than strictly required for data safety (wrapping never widens
visibility regardless of who triggers it, see above) — it's a deliberate
choice to minimize the blast radius of a buggy or misused bulk tool that
scans every app's data on a tenant, not just the invoking app's own.

Neither function has a UI yet — Phase 1 is explicitly data/data-access
only ("Do NOT yet redesign JoaOffice or JoaBooks screens"). They are
callable today via any authenticated admin session's server-function
client, or a future admin settings page can wire simple buttons to them.

**Backfill never deletes legacy rows.** `public.attachments` rows are
read-only inputs to this process, never touched.

## Testing status (honest accounting, not aspirational)

This repo has **no test framework configured** in any of the four app
repos (`package.json` has no `test` script, no vitest/jest config exists
anywhere) — this predates Content Core and was not introduced by it.
Additionally, this sandbox **cannot reach `supabase.co`**, so no
integration test against the live schema/RLS can be executed from here
regardless of framework. Given that, and given the explicit instruction
not to let test-writing block moving forward: the behavioral test matrix
below is a **documented checklist for manual/future QA**, not something
that has been run.

- [ ] Cross-tenant denial: user in tenant A cannot see a `content_item` in
      tenant B, even by guessing its UUID.
- [ ] Tenant member (no special role) can see content whose only relation
      is an ordinary, non-restricted record they already have access to.
- [ ] Inserting a `content_relations` row pointing at a UUID that isn't a
      real target record in a *different* tenant is denied (the RLS
      `content_relations_insert` policy's `user_can_view_content_relation_target`
      check should fail — no row belongs to that tenant to resolve).
- [ ] Duplicate relation (same content_item_id/app_code/entity_type/
      entity_id/relation_type) is denied by the `UNIQUE` constraint.
- [ ] `createExternalLinkContent` accepts an `https://` URL, rejects
      `javascript:alert(1)`.
- [ ] Attachment-backed content creation (`getOrCreateContentItemForAttachment`)
      succeeds for a caller who can already view the source attachment.
- [ ] Unlink (`deleteContentRelation`) removes only the relation — the
      content item and its version(s) still exist and are still fetchable
      by anyone with a different, still-valid relation to it.
- [ ] `archiveContent(archived: true)` sets `archived_at`; the item is
      still fully readable by RLS (archived is a display filter an app UI
      applies, not a visibility restriction) — confirm no app accidentally
      treats `archived_at IS NOT NULL` as "hidden from RLS."
- [ ] A JoaHR `tax_identity_restricted` W-9's content item, once also
      related to a JoaBooks `party`, is still denied to a
      JoaBooks-only `finance_manager` with no HR role (the
      cross-namespace-AND test — see "The cross-app leak this design
      specifically defends against" above).
- [ ] A JoaOffice `employee_document` (protected via `document_links`'
      own `security_level` RLS) cannot be permanently deleted by a caller
      without a write role, even though the underlying `content_item`'s
      own RLS would otherwise allow archive/unlink.
- [ ] Running `runContentBackfill` twice in a row on the same tenant/page
      produces `inserted: 0` the second time, with the first run's
      `content_items_count_after` unchanged.

## Deviation: no `content_access_scopes` table

GPT's original proposal (Phase 0 prompt, Section H) called for a fourth
table, `content_access_scopes`, as a dedicated place to store per-item
access rules. **This was not built.** Instead, `content_relations.entity_type`/
`entity_id` deliberately reuse the exact same value space as
`public.attachments.doc_kind`/`doc_id`, so a relation's visibility is
computed by calling the already-unified, already-audited
`public.user_can_view_doc()` directly.

This was flagged to the user as a deviation *before* implementation (not
discovered after the fact) with the explicit reasoning: a separate
`content_access_scopes` table would mean writing and maintaining a
**second** authorization ruleset in parallel with `user_can_view_doc()`'s
existing per-doc-kind dispatch — two places that both have to correctly
express "a JoaHR `tax_identity_restricted` document requires X role,"
drifting independently, which is exactly the class of bug the
`user_can_view_doc()` drift incident (three repos' hand-authored copies
diverging, one shipping a live security hole) already demonstrated
happens in this codebase when a security rule exists in more than one
place. The user approved proceeding without it. If a future requirement
genuinely cannot be expressed as "does the caller pass `user_can_view_doc`
for this entity_type/entity_id" (e.g., a scope that depends on something
*other* than an existing entity's own visibility rule — a pure
Content-Core-native ACL with no corresponding `doc_kind` at all), that is
the trigger to reconsider this decision, not before.

## JoaSOP: consumer-only integration (built Phase 5)

Per the user's explicit decision (Phase 0 open question 4): JoaSOP
integrates with Content Core only as a **consumer** of existing content as
supporting material on a policy/procedure (option (a) of the choices
presented), never as a producer of its own linkable content types the way
JoaBooks exposes `party`/`payment_request`/etc. This is now built:
`joasop/src/lib/content-core-adapter.functions.ts` —
`listEligibleContentForSop` (RLS-scoped picker, not staff-gated, since the
content being browsed may originate from any app), `createPolicyFromContentItem`
(creates a normal draft `documents`/`document_versions` row via the same
`insertDraftDocument` helper `createDocument` itself uses, then adds one
`content_relations` row through the caller's own RLS client),
`listLinkedContentForDocument`/`unlinkContentFromDocument`/`getLinkedContentFile`.
JoaSOP still has **no** `ContentRelationProvider` implementation and never
appears as a link target from another app's "Link to record" picker — it
only ever receives, never offers, matching the consumer-only decision.

Notable constraint this adapter works around: `sop_can_view_document()`'s
SQL body is not present in the JoaSOP repo at all (only called by name,
same as `attachments.functions.ts` already did) — so the adapter never
reimplements or guesses at its rules; every check either reuses that exact
RPC call or delegates to `user_can_view_content()`/RLS. This is the
correct pattern for any future adapter touching an app whose canonical
access function isn't vendored locally: call it by name, never
reconstruct it.

## Phase 2 — reusable UI layer (this package)

Everything in this section lives in `joasuite-shared/src/` and ships in
the published `dist/` — no app-specific domain logic (Bill APIs, worker
APIs, contract APIs, JoaSOP APIs) exists anywhere in this package; every
piece below is either a neutral type, a DI contract an app implements, or
a presentational component that receives its data/behavior via props.

### Neutral types (`src/lib/content-core-types.ts`)

`ContentType`, `ContentItem`, `ContentVersion`, `ContentOrigin`,
`ContentItemDetail`, `ContentSearchFilters` — camelCase mirrors of the
`content_items`/`content_versions` columns (DB-facing app code stays
snake_case; the mapping happens inside each app's own `ContentProvider`
implementation, not in this package). **No `ContentAccessScope` type
exists** — same deviation as Phase 1's schema: visibility is derived at
query time via `user_can_view_content()`, never stored as a scope record,
so there is nothing for a type to represent. See "Deviation: no
`content_access_scopes` table" above; this is the same decision, not a
new one.

### Provider contracts (DI seams)

- **`ContentRelationProvider`** (`src/lib/content-relations.ts`) — already
  existed from the JoaBooks/JoaHR pilots; extended this phase with two
  *optional* methods, `canLink(entityType, entityId)`/
  `canUnlink(entityType, entityId)`, plus an optional `icon` field on
  `RelationEntityTypeOption`. Both are UI-presentation hints only (e.g.
  grey out one search result) — omitting either means "always show the
  control, let the server reject if it must." `resolveEntities` stays
  batch-shaped (`resolveEntity` singular, as the prompt's literal example
  named it, was not built — a batch call is what `RelatedRecordsPanel`
  actually needs to resolve a whole list of relations at once, and JoaBooks'
  existing `resolveContentRelationEntities` server fn already returns a
  batch; adding a singular variant on top would be pure duplication for no
  real caller).
- **`ContentProvider`** (`src/lib/content-core-provider.ts`, new) — the
  DI seam for "list / get / upload / add external link / add version /
  archive." **This is the "Shared Content Service" the Phase 2 prompt's
  Section 3 asks for.** Deviation worth calling out explicitly: the
  prompt's wording ("Shared Content Service," "expose reusable
  operations") could be read as asking for a stateful service object/class
  that shared UI components pull from a context. That is **not** what was
  built. Instead `ContentProvider` is a plain interface, passed as an
  ordinary prop into whichever component needs it — the same
  "presentational component + injected provider prop" pattern already
  established by `ContentRelationProvider`/`DocumentLibraryTable`/
  `RelatedRecordsPanel` before this phase, rather than introducing a
  second, heavier DI mechanism alongside the first one. Reasoning: this
  package has no precedent anywhere for a stateful cross-component service
  singleton (the closest thing, `BoundServerFns`/`fns`, is deliberately
  NOT used by any Content Core component either — see the pre-existing
  `DocumentLibraryTable` comment: "matching the plain presentational
  pattern... rather than the fns-DI pattern used by pages like
  TeamListPage... keeps adoption a zero-wiring drop-in"). Every
  `ContentProvider` method an app implements is a thin wrapper around that
  app's own local `createServerFn(...)` call, per the suite-wide
  app-local rule.
- **`ContentAuthorizationProvider`** (same file) — `canView`/`canModify`,
  plus optional `canDeletePermanently`. Explicitly UI-presentation-only:
  "the UI may use it for presentation, but server enforcement remains
  authoritative" (Section 5's own words) — a component with none injected
  simply shows its controls and lets the server reject, rather than
  becoming insecure by omission. No component in this package calls this
  provider internally to *decide* whether to render itself except where
  documented (`DeletePermanentlyAction` is rendered by the HOST APP only
  after checking `canDeletePermanently` itself — the component does not
  call the provider on its own; see that component's own doc comment).

### Shared UI components (`src/components/`)

| Component | Maps to prompt's Section 6 name | Notes |
|---|---|---|
| `DocumentLibraryTable` | `ContentTable` | Pre-existing (JoaBooks pilot). Kept its established name rather than renamed to `ContentTable` — "use names appropriate to the actual code style" per the prompt itself, and renaming a component already wired into a live JoaBooks route for no functional change is exactly the kind of churn "do not rewrite stable systems merely for elegance" (this phase's own closing instruction) warns against. |
| — | `ContentGrid` | Not built — "if needed," and no current consumer needs a grid layout over a table. |
| `ContentDetail` | `ContentDetail` | New. Composes `ContentVersionsPanel` + `RelatedRecordsPanel` + `ArchiveContentAction` + optional `DeletePermanentlyAction` + header metadata. An app can use the smaller pieces directly instead if its own detail page layout differs — this composition is a convenience, not a required entry point. |
| `ContentUploader` | `ContentUploader` | New. Neutral "pick a file / add a link" shell — the actual upload mechanics (storage bucket, signed URL) stay in the app's own `onUploadFile` callback; this component never touches storage. |
| `AddExternalLinkDialog` | `AddExternalLinkDialog` | New. Client-side scheme validation for immediate feedback only — server-side validation (JoaBooks' `assertSafeExternalUrl`) is the real boundary. |
| `RelatedRecordsPanel` | `ContentRelationsPanel` | Pre-existing (JoaBooks/JoaHR pilots), kept its name for the same reason as `DocumentLibraryTable`. **Fixed this phase**: `provider` is now optional (was required) — see "Library works without a relationProvider" below, a real gap against Section 4's explicit requirement. |
| `LinkToRecordDialog` | `LinkToRecordDialog` | Pre-existing, unchanged. |
| `ContentVersionsPanel` | `ContentVersionsPanel` | New. Renders correctly today even for a content item with exactly one version. |
| `ArchiveContentAction` | `ArchiveContentAction` | New. Confirm-then-call-back; the "Archive" tier. |
| — | (no direct equivalent named) | `DeletePermanentlyAction` — new, added for symmetry with `ArchiveContentAction` and because Section 9 explicitly requires the UI to distinguish this third tier visually, even though there is deliberately no shared primitive for *performing* the deletion (see Phase 1's "Safe delete semantics" table above — that decision is unchanged by this phase). |

### UI terminology is injectable (Section 7)

No new component in this phase hardcodes a page-level name like "File
Library" or "Document Vault." Every component that has a title-ish string
accepts an override prop (`ContentVersionsPanel.title`,
`AddExternalLinkDialog.title`, `ContentUploader.uploadLabel`/`linkLabel`/
`linkDialogTitle`, `ContentDetail.labels`) and otherwise falls back to an
i18n key under the `content_core.*` namespace with an English default —
an app can override the *value* of that key in its own locale files
without ever touching this package's source, exactly like every other
i18n key in this suite (see JoaBooks' Bill/PR rename for the established
"never rename the key, only its value" convention). Column-header-level
strings on `DocumentLibraryTable` (a pre-existing component, not touched
this phase) work the same way already.

### Content search/filter contract (Section 8)

`ContentSearchFilters` (types file) is the shared *shape* apps agree to
accept in `ContentProvider.listContent`. There is no shared filter-bar UI
component — Section 8 asks for a contract, not necessarily a widget, and
the one real consumer so far (JoaBooks' Document Library page) already
has its own filter UI composed at the page level calling
`listContentRelations`/etc. directly; a generic filter-bar component has
no second consumer yet to prove out its shape, so it was not built
("avoid overbuilding"). "Do not leak results the user cannot access" is
satisfied structurally: every `ContentProvider.listContent` implementation
queries through `content_items_select` RLS (or an equivalent
already-RLS'd path), never through `service_role` for a read a UI
displays back to the user.

### Delete/Archive UX (Section 9)

No shared component anywhere in this package exposes a single ambiguous
"Delete" action. Three distinct, separately-labeled controls exist:
`RelatedRecordsPanel`'s per-relation "Unlink" button, `ArchiveContentAction`
("Archive"/"Restore"), and `DeletePermanentlyAction` ("Delete
permanently," destructive-styled, host-app-gated as described above).
`DocumentLibraryTable`'s pre-existing generic `onDelete` prop (labeled
"Delete" via `doc_library.delete`) predates Content Core and is **not**
one of these three — it is JoaBooks' own file-row delete action against
the underlying attachment directly, unrelated to a content item's
relation/archive/permanent-delete tiers. Left as-is since changing its
meaning is exactly the "do not yet redesign JoaOffice or JoaBooks screens"
scope boundary this phase was told to respect.

### Testing status (extends Phase 1's honest accounting)

Same structural situation as Phase 1: no test framework is configured in
this package (`package.json` has no `test` script). What Section 10 asks
for is mostly pure frontend logic (mock providers, no live DB needed) —
unlike Phase 1's DB/RLS behavioral matrix, these genuinely could run
without touching `supabase.co` — but introducing a whole new test
framework/config to a package that has never had one is a real
architectural addition, not a quick add, so it was not done unilaterally
this phase. Manual/structural verification performed instead:

- [x] **Library works without a relationProvider** — fixed as part of this
      phase: `RelatedRecordsPanel.provider` is now optional; verified by
      reading the component's own conditional rendering (the "Link to
      record" button and `LinkToRecordDialog` only mount when `provider`
      is truthy) and by `tsc`/`tsup`'s DTS build succeeding with the
      updated (optional) prop type.
- [x] **Relations appear only when provider exists** — same fix; without a
      provider, existing `relations` still render (label falls back to
      the raw `entityType` string), just with no way to add a new one or
      resolve a friendlier label — matches "function without relationship
      controls," not "hide relations entirely."
- [x] **App-specific entity knowledge does not leak into generic
      components** — verified by inspection: no file under `src/` (this
      phase's additions or pre-existing) references `party`,
      `payment_request`, `bill`, `worker_document`, or any other
      app-specific `doc_kind`/entity-type literal. Every such string is
      supplied by the host app through `ContentRelationProvider`/
      `ContentProvider` at runtime.
- [ ] **Unauthorized actions are not shown** / **server rejection handled
      correctly** / **archive differs from unlink** / **external links
      work** / **existing attachment-backed content works** — these need
      a real running app + live DB session to verify meaningfully (mock
      providers can prove the component *calls* the right callback, but
      not that the callback's real implementation behaves correctly) —
      deferred to whichever app first wires these components into a real
      page, same limitation as Phase 1's behavioral checklist.

## Known remaining risks (updated through Phase 6)

Resolved since the last update of this section (kept here, struck through
in spirit rather than deleted, so the history of what used to be a risk
stays visible — see "Cleanup" below for the policy on removing stale
content entirely):

- ~~No shared "Delete Permanently" primitive exists yet outside JoaOffice~~
  — JoaBooks now has its own (`deleteContentItemPermanently`, Phase 4),
  independently designed with an extra multi-relation guard JoaOffice's
  doesn't have. Two real implementations now exist; still no *shared*
  primitive in `joasuite-shared` itself, and that remains a deliberate
  choice (see the "Safe delete semantics" table above) — different apps
  have made different, reasonable choices about exactly what "permanently"
  cascades into, and forcing one shared implementation would mean picking
  a single answer that doesn't fit every app.
- ~~None of the Phase 2 shared UI components have a real consuming app
  yet~~ — JoaBooks' File Library (Phase 4) is a real, live consumer of
  `ContentDetail`, `RelatedRecordsPanel`, `LinkToRecordDialog`,
  `AddExternalLinkDialog`, `ArchiveContentAction`, `DeletePermanentlyAction`,
  and `ContentVersionsPanel` — every component in the Phase 2 table above
  except `ContentUploader`/`ContentGrid` now has at least one real caller.
  Layout/prop-shape assumptions made without a live consumer have now been
  exercised; no shape mismatch was found.

Still open:

- The manual QA checklist above (Phase 1) has still not been executed
  against the live DB from this sandbox (no `supabase.co` access). The
  automated security matrix suite added in Phase 6 ("Final security
  matrix" below) *has* now been run by the user, from their own machine,
  against the live DB — 21/21 passed 2026-08-22 — but that only covers
  the RPC-level authorization matrix, not real-browser/UI behavior. No
  live-user-session behavioral verification (clicking through the actual
  app) has happened from this environment at any point in this project.
- `runContentBackfill`'s per-attachment work is not batched/transactional
  beyond one page — a crash mid-page leaves some attachments in that page
  wrapped and others not; safe to just re-run the same page (idempotent),
  but not atomic.
- `content_items_update` RLS still grants write to anyone who can view (no
  separate editor tier) — unchanged since Phase 1, still an intentional
  simplification per the schema migration's own comment, still worth
  revisiting once/if a real caller needs write access narrower than view
  access on the same item.
- `ContentProvider`/`ContentAuthorizationProvider` (the two DI-contract
  *types*, distinct from the underlying operations they describe) still
  have no literal reference implementation in any app repo — JoaBooks'
  File Library page wires individual callback props (`onArchive`,
  `onDeletePermanently`, `onLinkRelation`, etc.) directly to `ContentDetail`
  rather than constructing an object shaped like `ContentProvider`. The
  underlying operations all exist and work; the specific DI-object shape
  these two types describe has simply never been the pattern any real
  page followed — `ContentRelationProvider` (a different, older contract)
  is the one that has real implementations. Worth revisiting whether
  `ContentProvider`/`ContentAuthorizationProvider` should be simplified,
  removed, or left as an unused-but-harmless contract the next time this
  file is substantially revised (see "Cleanup recommendations" below —
  not touched destructively as part of Phase 6 itself).
- Duplicate detection (Phase 6) is schema-ready (`content_versions.sha256`/
  `file_size`/`mime_type` already exist) and has one reference query
  (JoaBooks' `findDuplicateContent`), but `sha256` is not populated by any
  existing wrap path (`getOrCreateContentItemForAttachment`,
  `wrapAttachmentAsContentItem`, JoaHR's inline wrap, etc.) — every one of
  those would need to download+hash the file at wrap time to make exact
  (not just size+mime) duplicate detection actually fire. Not retrofitted
  in this pass — see "Duplicate detection foundation" below.
- Existing Content Discovery (Phase 6) suggestion heuristics are
  deliberately simple (`pg_trgm` title/name similarity, keyword matching)
  per the explicit "do not make AI classification required" instruction —
  they will under- and over-suggest in ways a smarter classifier wouldn't;
  this is accepted as the correct v1 trade-off, not an oversight.

---

# Phase 6 — Future-app extension contract, discovery, and final hardening

Everything below was added in Phase 6, whose explicit charter was:
**finalize and document the architecture so JoaCRM, JoaApproval, and any
future JoaSuite app can integrate without another schema redesign — do
NOT build the full JoaCRM or JoaApproval product.** Nothing in this
section is a shipped product feature for either hypothetical app; the
CRM/Approval material below is a worked example proving the contract,
not a spec anyone is building against yet.

## Future App Integration Contract

This is the answer to "what does a brand-new JoaSuite app need to do to
plug into Content Core?" — written so a future implementer (human or
Claude) can follow it without re-deriving anything from first principles.

**A new app never needs to change:**

- `public.content_items` — no new columns, no new `content_type` values.
- `public.content_versions` — no new columns.
- `public.content_relations` — no new columns. Critically:
  **`app_code` and `entity_type` are plain `text`, not enums** (confirmed
  by reading `20260820140000_content_core_schema_foundation.sql`'s
  `CREATE TABLE` statements directly — there is no `CHECK` constraint or
  Postgres enum type restricting either column to a fixed value list).
  A brand-new app_code like `'joacrm'` or a brand-new entity_type like
  `'joacrm.opportunity'` is valid the instant the first row using it is
  inserted — no migration, no `ALTER TYPE ... ADD VALUE`, nothing.
- `public.user_can_view_content()` / `user_can_view_content_relation_target()`
  — these already dispatch generically by `entity_type` prefix (see
  "Authorization dispatch" above); they don't need to know a new app
  exists.
- Any other app's code, schema, or RLS policy.

**A new app must add exactly one thing to shared, cross-app code:** a new
`ELSIF _doc_kind::text LIKE 'newapp.%' THEN ...` branch (or a specific
`_doc_kind = '...'` branch) inside `public.user_can_view_doc()`, calling
into that app's own authorization function — the same pattern every
existing app already follows (`joahr.%` → `hr.can_view_worker_document()`,
`joasop.document` → `sop_can_view_document()`, `joaoffice.%` →
`is_internal_staff_scoped(...,'joaoffice')`). This is a **JoaBooks-owned
migration** per "Migration ownership" above — write it there, vendor it
byte-identical into every other repo's `supabase/migrations/`, same as
every prior `doc_kind` branch addition in this project's history. This is
the one and only schema-adjacent touchpoint a new app requires, and it's
additive (`CREATE OR REPLACE FUNCTION`, new branch appended) — never a
breaking change to an existing branch.

**What the new app supplies entirely on its own side** (no cross-repo
coordination needed beyond the one migration above):

| Adapter | Required? | What it does | Reference implementation |
|---|---|---|---|
| **Authorization provider** | Yes (the app's own `can_view_<X>()` Postgres function the new `user_can_view_doc()` branch calls into) | Decides who can see one of the app's own domain records. Entirely the new app's business — Content Core never inspects a role directly (see "Authorization dispatch"). | `hr.can_view_worker_document()`, `sop_can_view_document()` |
| **Relation provider** (`ContentRelationProvider`) | Optional — only if the app wants to appear as a "link this file to a record" target | `getEntityTypes()`/`searchEntities()`/`resolveEntities()`/`getEntityHref()`, implemented as the app's own local `createServerFn(...)` calls (never re-exported from `joasuite-shared`'s `dist/` — see the suite-wide "createServerFn must be app-local" rule in every app's CLAUDE.md) | JoaBooks' `content-core.functions.ts` (6 entity types) |
| **App-specific metadata extension** | Optional | An app-owned table that references a `content_item_id` for data Content Core has no opinion about (JoaOffice's `office.document_links.content_item_id` carrying category/security_level/expiration/reminder_days is the existing precedent) | `office.document_links` |
| **Presentation components / wrapper** | Optional | Either build a page around the Phase 2 shared components (`ContentDetail`, `RelatedRecordsPanel`, etc.) or hand-roll a page-specific UI (JoaOffice's `DocumentVaultTable` predates and doesn't use the shared components at all) — both are valid, "adapters underneath existing UI" is explicitly preferred over a forced rewrite | JoaBooks' File Library (shared components); JoaOffice's Document Vault (hand-rolled) |
| **Domain record integration** | Yes, implicitly | The new app's own domain tables (`joacrm.accounts`, etc.) — Content Core never owns or duplicates these; a `content_relations` row only ever points *at* one by `(entity_type, entity_id)` | N/A — every app's own schema |

**One physical file, relations from many apps** is not a hypothetical —
it's exactly what already happens in production-shaped code today: a
contractor's W-9 (`joahr.worker_document` origin) gets a second relation
into `joabooks / party` via `linkWorkerDocumentToJoaBooksVendor`, and an
Office-origin policy PDF gets a `joasop.document` relation via
`createPolicyFromContentItem` — same content item, same physical file
(or, for the JoaSOP case, potentially zero new file rows at all), multiple
apps' worth of relations, each gated by that specific relation's own
namespace check.

## JoaCRM example contract (not implemented — proves the contract only)

A hypothetical future JoaCRM would need four record types: **Account**,
**Contact**, **Opportunity**, **Activity**. Working through what each
needs, to prove the contract above is sufficient without inventing
anything new:

- **Migration**: one JoaBooks-owned `ALTER TYPE public.doc_kind ADD VALUE`
  set (`'joacrm.account'`, `'joacrm.contact'`, `'joacrm.opportunity'`,
  `'joacrm.activity'`) plus one new `ELSIF _doc_kind::text LIKE 'joacrm.%'`
  branch in `user_can_view_doc()` delegating to a new
  `joacrm.can_view_record()` (or per-type functions) that JoaCRM owns and
  writes itself.
- **Authorization provider**: `joacrm.can_view_record()` — JoaCRM's own
  business (e.g. account-team membership, sales-region scoping — whatever
  JoaCRM's actual access model turns out to be; Content Core has zero
  opinion on this).
- **Relation provider**: JoaCRM's own `content-core.functions.ts`-
  equivalent implementing `getEntityTypes()` → `[account, contact,
  opportunity, activity]`, with `searchEntities`/`resolveEntities`
  querying JoaCRM's own tables — copy JoaBooks' file's *shape*, not its
  entity list (per "App adapter contract" above).
- **Worked example matching the Phase 6 prompt's own scenario**: an
  `RFP.pdf` uploaded once in JoaCRM gets three `content_relations` rows:
  `joacrm / account / A`, `joacrm / opportunity / O` (both same-namespace,
  OR-visibility between them per "The cross-app leak this design
  specifically defends against" — either being visible is enough since
  they share JoaCRM's own trust boundary), and `joabooks / project / P`
  (a different namespace — a caller needs to pass **both** the JoaCRM
  check for at least one of {A, O} **and** independently the JoaBooks
  check for P, per the AND-across-namespaces rule). One physical file,
  zero duplication, three business contexts. Note "project" isn't a real
  JoaBooks entity type today (Phase 4's ground-truthing confirmed
  JoaBooks has no `projects` table) — the example is illustrative of the
  *mechanism*, not a claim that this specific relation could be created
  against today's real JoaBooks schema without JoaBooks adding a Project
  concept of its own first.
- **No CRM UI, no `joacrm` repo, no new server functions were written for
  this phase** — this section exists purely to demonstrate the contract
  above requires nothing else.

## JoaApproval example contract (not implemented — proves the contract only)

A hypothetical future JoaApproval attaches *existing* content as evidence
to an approval request, without ever owning the files:

```
Approval Request #100
    -> Contract.pdf            (content_relations: joaapproval / approval_request / 100)
    -> Vendor Comparison.xlsx  (content_relations: joaapproval / approval_request / 100)
    -> Google Sheet URL        (content_relations: joaapproval / approval_request / 100)
```

- All three are ordinary `content_items` (two files, one `external_link`)
  that already exist for other reasons — likely originated in JoaBooks
  (the contract, the comparison sheet) or added directly as a link. None
  of them are created *by* JoaApproval; JoaApproval only ever adds a
  `content_relations` row pointing an existing item at
  `(entity_type: 'joaapproval.approval_request', entity_id: 100)` — the
  exact same "pick from existing content" pattern JoaSOP's
  `createPolicyFromContentItem`/`listEligibleContentForSop` already
  implements for real (see "JoaSOP: consumer-only integration" above) —
  JoaApproval would be JoaSOP's second real-world precedent for a
  consumer-only integration, not a new pattern.
- **Completing or closing Approval Request #100 must never delete, own,
  or take custody of those three content items.** This falls out of the
  architecture automatically, not from anything JoaApproval would need to
  implement specially: `content_relations` rows are pointers (see "Origin
  vs relation vs permission"), and the only thing that could delete a
  content item outright is a "Delete Permanently" action — which, per
  every existing implementation's design (JoaOffice's, JoaBooks'), is
  Unlink-tier-or-above and always a deliberate, separate user action, not
  a side effect of an unrelated domain-record status change like "approval
  completed."
- Authorization: `joaapproval.can_view_approval_request()`, JoaApproval's
  own business rules (likely: assigned approver, requester, or a
  privileged role) — again, zero Content Core involvement in *what* those
  rules are.

## Existing Content Discovery

Solves: a tenant that has used one JoaSuite app for years, then subscribes
to a second one, has real content sitting in Content Core (or eligible to
be wrapped into it) that would be useful in the new app — but nothing
proactively surfaces it. Two concrete implementations were built this
phase, one per the two activation examples in the Phase 6 prompt; both
share the same shape, documented here as the reusable pattern rather than
as shared code (per the suite-wide app-local `createServerFn` rule, this
cannot literally be one shared function — every app writes its own).

**The pattern:**

1. **Query, scoped by real authorization, never by role alone.** Both
   implementations query `content_items` through the *caller's own*
   RLS-scoped client (`context.supabase`, not `supabaseAdmin`) — a
   content item eligible for discovery may have originated in any app,
   so "is this user JoaBooks/JoaSOP staff" alone is not sufficient
   authority to decide what's discoverable (the same reasoning already
   documented for `listUnlinkedContentItems`/`listEligibleContentForSop`
   in the per-app integration work). `content_items_select` RLS
   (`user_can_view_content()`) is the only thing deciding what a given
   discovery query can even see.
2. **Deterministic candidate scoring, not a blanket list.** Rather than
   just "everything unlinked," a suggestion additionally proposes a
   likely *action* with a reason, computed from:
   - **JoaBooks** (`content-core.functions.ts`'s `suggestVendorLinks`
     query, new this phase): `pg_trgm` `similarity()` between the content
     item's `title` and every non-archived `party.name_en` in the tenant
     — the exact same fuzzy-match primitive `find_similar_vendors`
     already uses for vendor dedup, reapplied here rather than inventing
     a second scoring mechanism. A match above threshold becomes a
     suggested "Link to Vendor" (or "Link to Customer", based on the
     matched party's `is_vendor`/`is_customer` flags) action with the
     matched party's name and similarity score as the shown reason.
   - **JoaSOP** (`content-core-adapter.functions.ts`'s
     `suggestDocTypeForContent`, new this phase): a small deterministic
     keyword table (`handbook`→`handbook`, `policy`→`policy`,
     `procedure`/`sop`→`sop`, `safety`→`safety`, `training`→`training`)
     matched case-insensitively against the content item's `title` —
     "Employee Handbook.pdf" → suggested `doc_type: "handbook"`,
     pre-selecting (not auto-submitting) that value in
     `CreateFromContentDialog`.
   - Both are intentionally simple pattern-matching, not ML — see "Do
     not build AI dependency now" below.
3. **Suggestions require confirmation — nothing is auto-created.**
   Neither implementation ever inserts a `content_relations` row on its
   own; the suggestion is a read-only response the UI renders as an
   action button, and the actual relation is only created when the user
   clicks it — the exact same `createContentRelation`/
   `createPolicyFromContentItem` write path a manual "Link to record"
   action already goes through, with the same server-side re-validation.
4. **"Ignore" persists, without a new table.** Dismissing a suggestion
   writes one `content_relations` row with
   `relation_type: 'discovery_ignored'` (not the default `'related'`),
   `entity_type: '<app_code>.discovery'`, and `entity_id` set to the
   content item's own id (a self-referential marker — the same fallback
   pattern JoaOffice's `wrapAttachmentAsContentItem` already established
   for `entity_id: docId ?? contentItemId`). Future discovery queries
   `NOT EXISTS`-filter out any item with such a row for the current
   `app_code`. This is deliberately **not** a real domain relation (it
   never resolves to an actual record `user_can_view_doc` would check —
   `<app_code>.discovery` is not a `doc_kind` `user_can_view_doc()` has a
   branch for, so nothing outside the discovery query itself ever tries
   to interpret it), and it costs zero new tables/migrations —
   `content_relations.relation_type` is plain `text`, not constrained to
   `'related'`, so this required no schema change either, matching the
   Phase 6 charter's "no schema redesign for a new capability" spirit
   even though it's the same repo, not a new app.

## JoaBooks activation example (built)

`app.documents.index.tsx`'s File Library gained a fifth tab, **Suggestions**,
alongside All/Recent/Unlinked/Archived: content items with no `joabooks`
namespace relation and no `discovery_ignored` marker for `app_code:
'joabooks'`, each row showing the matched vendor/customer name and
similarity score plus three actions — **Link to Vendor**, **Link to
Customer** (whichever the party match implies; both offered if the party
is flagged as both), and **Ignore**. "Link to Bill" from the prompt's own
example list was **not** built as a separate action: a Bill doesn't have
a stable "name" to fuzzy-match a filename against the way a vendor/customer
does (a Bill's identity is its `request_no` + party, and the useful
association is almost always "this file relates to this *vendor*," with
which specific Bill, if any, better decided by the user via the existing
manual "Link to record" picker) — matching a filename directly to a
`request_no` would need OCR/content-aware extraction, explicitly out of
scope per "do not build AI dependency now."

## JoaSOP activation example (built)

`CreateFromContentDialog`'s picker step now shows a suggested `doc_type`
badge next to any content item whose title keyword-matches the table in
"Existing Content Discovery" above, and pre-selects that `doc_type` when
the item is picked (still fully editable before Create) — "Employee
Handbook.pdf" pre-selects `handbook`, "Expense Policy.pdf" and "IT
Security Policy.pdf" both pre-select `policy`. A dedicated "Ignore" action
was **not** added to the JoaSOP picker specifically — unlike JoaBooks'
Suggestions tab (a standing list the user would otherwise have to keep
re-dismissing), the JoaSOP picker is a one-shot, on-demand search the
user opens only when they intend to create something, so there is no
recurring "nag" to dismiss in the first place.

## Do not build AI dependency now

Every heuristic above (`pg_trgm` similarity, a fixed keyword table) is
deterministic, runs entirely in Postgres or plain TypeScript, and has zero
external-API/model dependency. Nothing in Content Core's correctness —
authorization, relation integrity, delete safety — depends on discovery
working well; a bad or missing suggestion just means a human uses the
existing manual "Link to record"/"Create Policy from existing content"
flow instead, which was already the only path before this phase. This
was a design constraint, not an implementation shortcut: swapping in a
smarter classifier later (an LLM-based title/content classifier, for
instance) is purely additive — it would replace the *scoring* step only,
behind the same "suggestion requires confirmation" contract, never
touching the schema or the write path.

## Duplicate detection foundation

**Schema is already ready, from Phase 1** — no migration needed this
phase. `content_versions.sha256`, `file_size`, `mime_type` have existed
since `20260820140000_content_core_schema_foundation.sql`; nothing
consumed them until now.

**Built this phase**: `findDuplicateContent(tenant_id, { size, mime,
sha256? })` in JoaBooks' `content-core.functions.ts` — a read-only query,
callable before an upload commits, that:

1. If `sha256` is provided, looks for an **exact** match
   (`content_versions.sha256 = :sha256`) — a true duplicate, byte-for-byte.
2. Otherwise (or in addition), a **possible-duplicate prefilter** on
   `(file_size, mime_type)` matching — cheap, always available even before
   any hash is computed, but a size+mime match is only a hint, not a
   confirmed duplicate (two unrelated PDFs can trivially share a byte
   count).
3. Returns candidate `content_item_id`s (visibility-filtered — the query
   runs through the caller's own RLS client, same reasoning as Discovery
   above) for the UI to show as "This file already exists. Link the
   existing file instead?" — **never auto-linked, never auto-merged**, an
   explicit user click is required either way, matching the prompt's own
   example wording verbatim.

**Not done this phase, flagged as real remaining work** (see "Known
remaining risks" above for the short version): `sha256` is not actually
*populated* by any existing wrap path today. Making exact-match detection
fire for real requires downloading the file from storage and hashing it
at wrap time in `getOrCreateContentItemForAttachment` (JoaBooks),
`wrapAttachmentAsContentItem` (JoaOffice), and the inline wrap block in
JoaHR's `linkWorkerDocumentToJoaBooksVendor` — three call sites across
three repos, each a real (if small) change with its own failure mode
(storage download timeout/error) to handle. This was deliberately not
retrofitted into three repos' existing, working wrap paths as part of a
"foundation" phase explicitly scoped to *not* perform destructive or
broad changes — until this lands, `findDuplicateContent`'s exact-match
path will simply never find a hit (every `sha256` is `NULL`), and only
the size+mime prefilter is live. Recommended as the first concrete
follow-up task (see "Cleanup recommendations" below).

## Final security matrix

A new automated test suite —
`joabooks/src/lib/__tests__/content-core-security.test.ts`, using Vitest
(newly added as a devDependency; no test framework existed anywhere in
this project before this file) — asserts directly against the live
Supabase project's `user_can_view_content()`/`user_can_view_doc()`/
`has_role()`/`tenant_has_app()` RPCs (bypassing app-layer server functions
entirely, since the DB layer is what's actually shared/critical across
all 4 apps) for the eleven scenarios the Phase 6 prompt names: Office-only
subscription, Books-only, HR-only, SOP-only, Office+Books, Office+HR,
Books+HR, Office+SOP, multi-app-subscribed-tenant-with-user-assigned-to-
only-one-app, different roles in different apps, and cross-tenant denial —
plus the two invariants the prompt calls out explicitly by name:
**subscription != permission** (a tenant subscribed to an app doesn't
mean every member can see that app's content) and **relation != permission**
(a `content_relations` row existing doesn't mean the row's creator, or
anyone else, automatically gains access through it — access is still
re-derived from `user_can_view_doc()` every time).

**Executed against the live DB 2026-08-22**: written from a sandbox with no
network path to `supabase.co` (the same constraint disclosed in every app
repo's own CLAUDE.md "DB migrations in this repo" section, and in this
file's pre-Phase-6 "Testing status" sections above), so it could only be
run by the user, from their own machine, with real `SUPABASE_URL`/
`SUPABASE_SERVICE_ROLE_KEY` set (`npm run test:security` in joabooks). User
ran it and reported back: **21/21 tests passed** — confirms
`user_can_view_content()`/`user_can_view_doc()` actually enforce
subscription != permission and relation != permission on the live,
shared Supabase project, not just in the migration source read during
Phase 6. Separately confirmed the same day:
`20260822000000_fix_joaoffice_tenant_has_app_gap.sql`'s raw SQL was pasted
into the live DB and verified via `pg_get_functiondef('public.user_can_view_doc'::regproc)
LIKE '%tenant_has_app(_tenant, ''joaoffice'')%'` returning `true` — this
specific check matters because the 21/21 pass above doesn't by itself
prove it: scenario 2 ("Office-only subscription") in this suite doesn't
construct a "has a joaoffice role but tenant isn't subscribed to
joaoffice" case (unlike scenario 3's HR equivalent, which does), so it
needed its own separate confirmation.

## Final architecture diagrams

**Content flow** — how a physical file becomes visible through a domain
record:

```
DOMAIN RECORDS            (a Bill, a Worker Document Requirement, a Policy,
      |                    a future CRM Opportunity — owned entirely by
      |                    each app's own schema; Content Core never
      |                    duplicates or owns these)
      v
CONTENT RELATIONS         (public.content_relations — many-to-many pointers:
      |                    which content_item(s) this record is linked to,
      |                    tagged with app_code + entity_type + entity_id)
      v
SHARED CONTENT CORE       (public.content_items — the logical "this
      |                    document/link" object: title, description,
      |                    dates, archive flag, origin provenance)
      v
CONTENT VERSIONS          (public.content_versions — one point-in-time
      |                    representation; current_version_id picks
      |                    which one is "current" today)
      v
ATTACHMENTS / STORAGE /   (public.attachments + Supabase Storage for a
EXTERNAL URL               file, or a validated http(s) URL for a link —
                            never both, never neither)
```

**Independently, authorization flow** — how "can this user see it" is
decided (deliberately a *separate* chain from the content-flow diagram
above; nothing in the top diagram determines visibility on its own):

```
CONTENT ITEM
      |
      v
ACCESS SCOPES              (no dedicated table — see "Deviation: no
      |                     content_access_scopes table" above. Derived
      |                     at query time by grouping the item's
      |                     content_relations rows into app-code
      |                     namespaces and requiring the caller to pass
      |                     every namespace's own check — AND across
      |                     namespaces, OR within one)
      v
APPLICATION AUTHORIZATION  (user_can_view_doc()'s per-entity_type-prefix
ADAPTERS                    dispatch — hr.can_view_worker_document(),
                             sop_can_view_document(),
                             is_internal_staff_scoped(...,'joaoffice'),
                             JoaBooks' own per-doc_kind logic — each
                             entirely owned by its own app, none of them
                             known to Content Core itself)
```

**Ownership summary** (answers "who is allowed to change this"):

| Concept | Owned by |
|---|---|
| `content_items`/`content_versions`/`content_relations` schema | JoaBooks (canonical migration source — see "Migration ownership") |
| `user_can_view_content()`/`user_can_view_content_relation_target()` | JoaBooks (canonical; dispatches generically, never app-specific logic inline) |
| `user_can_view_doc()`'s per-app branches | JoaBooks writes the migration; each app owns the *function it delegates to* (`hr.can_view_worker_document()` is JoaHR's, `sop_can_view_document()` is JoaSOP's, etc.) |
| A specific content item's data (title, versions, etc.) | Whichever row's `created_by`/`source_app` says — Content Core doesn't reassign ownership on relation changes |
| A specific `content_relations` row | The app that created it (`app_code` column) — but per RLS, deletable by anyone who can prove access to *both* sides, not just the creator |
| App-specific metadata extension tables (`office.document_links`, etc.) | Each app's own repo entirely |
| `ContentRelationProvider`/adapter server functions | Each app's own repo, own local `createServerFn` calls, never `joasuite-shared`'s `dist/` |
| Shared presentational UI components (`ContentDetail`, etc.) | `joasuite-shared`, versioned via its own git history, consumed by pinned commit SHA per app |

**Deletion summary** (the three tiers, restated as one table for quick
reference — full detail in "Safe delete semantics" above):

| Tier | Destroys | Destroys physical file? |
|---|---|---|
| Unlink | One `content_relations` row | Never |
| Archive | Nothing — sets a visibility flag | Never |
| Delete Permanently | `content_relations` (all) → `content_versions` → `content_items`, app-specific whether it cascades further | App-specific decision; JoaOffice and JoaBooks both currently cascade into the attachment + storage object, but only after JoaBooks' extra "not linked from elsewhere" guard passes |

**Migration summary**: one canonical repo (JoaBooks) writes every Content
Core schema migration; it's copied byte-identical into every other app's
own `supabase/migrations/` folder (schema-history accuracy, not
re-execution — the tables are shared on one physical DB); `core-vendor/
manifest.txt` tracks `.sql` files the same way it already tracked shared
`.ts` files, so a future puller (a new app repo, or a currently-unattached
one) picks up the full migration set automatically.

## Cleanup recommendations (not performed — recommendation only)

Per the Phase 6 charter's own instruction ("do not delete compatibility
paths merely because the new architecture exists... provide a separate
cleanup recommendation before destructive removal"), nothing below has
been deleted. This is a list for a human to review and explicitly approve
before any of it is acted on:

1. **`content_items.title`/`description` fields' consistency across apps**
   — spot check whether every wrap path (JoaBooks/JoaOffice/JoaHR) sets
   `title` to the same kind of value (filename vs. a human label) —
   currently all three use the underlying `attachments.filename`, so this
   is consistent today, but worth a lint/test rather than trusting
   convention as the project grows.
2. **Promote `assertSafeExternalUrl` to `joasuite-shared`** — flagged as
   "not yet done" since Phase 2; now that JoaOffice has independently
   reimplemented the identical http/https-only check for its own external
   link support, there are two copies instead of one, exactly the kind of
   drift risk this project's own incident history (the `user_can_view_doc()`
   drift) warns about. Low risk to promote (pure function, no state), but
   not done automatically here since it touches 2 existing call sites'
   imports — a human should choose the moment.
3. **`ContentProvider`/`ContentAuthorizationProvider` types** — per "Known
   remaining risks" above, these have no real implementation anywhere.
   Recommend either (a) writing the first real one the next time an app
   builds a *second* Content-Core-native detail page (to see if the
   contract actually fits a second real consumer), or (b) if that never
   happens within a reasonable window, removing the two types as
   speculative/unused — do not remove preemptively; wait for evidence one
   way or the other.
4. **`sha256` population** — the concrete next step named in "Duplicate
   detection foundation" above; recommended as the next phase's first
   task, not bundled into this one.
5. **`DocumentLibraryTable`'s legacy `onDelete` prop** — still JoaBooks'
   own raw-attachment hard-delete, predating and structurally unrelated to
   the Unlink/Archive/Delete-Permanently tiers documented throughout this
   file (see "Delete/Archive UX" above). Recommend eventually folding it
   into the same three-tier model File Library's `ContentDetail` dialog
   already uses, so there's only one delete mental model on the page
   instead of two — but this is a real (if small) behavior change to a
   live control, so flagged for explicit review, not done here.
6. **Do NOT** clean up: the `payment_requests` table naming history, any
   `'bill'` doc_kind dead-code paths, or anything else covered by an
   already-completed, already-decided cleanup phase documented in an app
   repo's own CLAUDE.md (e.g. JoaBooks' Bill/PR unification Phase 7/8) —
   those are unrelated projects with their own closed decision trail; do
   not conflate "Content Core cleanup" scope with them.
