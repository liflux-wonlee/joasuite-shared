# Shared Content Core — architecture

Status: Phase 1 (database/data-access foundation) implemented. No app UI
has been redesigned around this yet except JoaBooks' Document Library
(pilot) and the JoaHR↔JoaBooks W-9 relation (pilot). JoaOffice's Document
Vault has been migrated onto this foundation. JoaSOP integration is
deliberately deferred (see "Deferred: JoaSOP" below).

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
2. **UI layer** (optional — only JoaBooks has this today):
   `ContentRelationProvider` (`joasuite-shared/src/lib/content-relations.ts`)
   — `getEntityTypes()`/`searchEntities()`/`resolveEntities()`/
   `getEntityHref()` — lets `LinkToRecordDialog`/`RelatedRecordsPanel`
   (also in `joasuite-shared`) offer a "link this to a record" picker
   without those shared components knowing anything about any specific
   app's entities. Per GPT's "current-app capability" rule, an app only
   implements the provider methods for entity types **it itself** can
   search/display — JoaOffice, for instance, supplies no provider at all
   today, so no JoaBooks financial-linking controls appear inside
   JoaOffice even on a tenant that has both apps.

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
| **Delete Permanently** | Cascade-delete the content item's relations → versions → (app-specific: optionally the underlying attachment + storage object too). | No single shared primitive by design — whether "permanently delete" also deletes the underlying attachment is an app-specific decision. JoaOffice's `deleteDocumentLink({ deleteAttachmentToo: true })` is the one app that has built this tier so far; see `document-vault.functions.ts`'s `deleteContentItemCascade`. |

There is no shared "Delete Permanently" primitive in `content-core.functions.ts`
itself (JoaBooks) yet, since no JoaBooks UI currently needs it — the
Document Library's delete action today is Unlink-only. Add one when a real
caller needs it, following JoaOffice's cascade as the template.

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

## Deferred: JoaSOP

Per the user's explicit decision (Phase 0 open question 4): JoaSOP
integrates with Content Core only as a consumer of *existing* content as
supporting material on a policy/procedure (option (a) of the choices
presented), not as a producer of its own linkable content types, and this
has not been built yet — deferred, not scoped out permanently. When
picked up: JoaSOP's own `joasop.document` entity type already has a
`user_can_view_doc()` branch (delegates to `sop_can_view_document()`), so
the dispatch-side work is already done; what remains is JoaSOP's own
`content-core.functions.ts`-equivalent adapter (search/resolve for
`joasop.document`) and, if desired, a "insert existing content as
supporting material" UI affordance on the policy editor.

## Known remaining risks (as of this writing)

- The manual QA checklist above has not been executed against the live
  DB. The structural pieces (RLS policies, unique constraints, function
  bodies) have been read back and match design, but no live-user-session
  behavioral verification has happened yet.
- `runContentBackfill`'s per-attachment work is not batched/transactional
  beyond one page — a crash mid-page leaves some attachments in that page
  wrapped and others not; safe to just re-run the same page (idempotent),
  but not atomic.
- No shared "Delete Permanently" primitive exists yet outside JoaOffice's
  app-specific implementation — a second app that needs this tier will
  need to write its own cascade, at least until a real second caller
  justifies promoting a shared version.
- `content_items_update` RLS currently grants write to anyone who can
  view (no separate editor tier) — acceptable for the current
  Unlink/Archive-only write surface, called out explicitly in the schema
  migration's own comment as an intentional, revisit-later simplification.
