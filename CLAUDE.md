# Package manager: bun only, and bun.lock is Lovable-internal

This repo is Lovable-connected (`.lovable/`) and Lovable installs with
**bun**, not npm. Confirmed 2026-07-08 (same discovery made in joabooks and
joaoffice): `bun.lock` has Lovable's private Google Cloud artifact-registry
mirror baked into every entry
(`https://europe-west{1,4}-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/...`).
That means `bun.lock` is **not a portable lockfile** — `bun install`
against it fails with 403s anywhere outside Lovable's own sandbox. Lovable's
bot regenerates `bun.lock` on its own after most edits; do not try to "fix"
or replace it.

Consequences for future work here:
- Never commit `package-lock.json` (or yarn/pnpm lockfiles) — gitignored
  now. A second, real lockfile just adds false signal for "did
  dependencies change" without ever being what Lovable actually builds
  from.
- For local verification in a sandbox without Lovable's registry
  credentials, `npm install` (public registry) works for this repo's own
  `tsup` build, but don't commit the resulting `package-lock.json`.
- Note: `joabooks`/`joaoffice` depend on this repo via
  `github:liflux-wonlee/joasuite-shared#<commit>` in their own
  `package.json` — that's a git dependency resolved by npm/bun in the
  *consuming* repo, and does not use this repo's own lockfile at all. This
  repo's lockfile situation only affects local dev/CI *of this repo
  itself*.

# core-vendor sync workflow

See `core-vendor/README.md` and `core-vendor/manifest.txt` for the
push/pull-from-core workflow. Canonical source for vendored files is
JoaBooks. Check `manifest.txt`'s per-app post-pull edit notes (e.g.
`APP_CODE` line in `recurring-v2.functions.ts`) before syncing a vendored
file — do not do a byte-for-byte copy without them.

# Security pattern: service-role writes must be role-gated, not just membership-gated

Any `createServerFn`/DI factory (`create*` in `src/server/`) that writes
through a service-role Supabase client (bypasses RLS entirely) must
additionally check a **specific role** for that action. Proving "is an
active tenant member" is not enough — active membership includes vendor/
approver/customer-portal users, and they must not be able to invoke
privileged actions just because the handler happens to use the
service-role client. This matters more here than in any single app repo:
a gap in a `src/server/` factory ships to all 4 consuming apps
(joabooks/joaoffice/joasop/joahr) at once.

Found and fixed 2026-07-28 in joabooks (in its own, non-shared
`payment-requests.functions.ts`, not in this package): `financeApprove`
and `markPaymentRequestPaid` used `supabaseAdmin` but only checked
`assertTenantMember`, so any active tenant member — including vendor/
approver-portal users — could self-approve or mark their own Bill
(Payment Request) paid, bypassing an RLS policy meant to restrict the
action to internal staff. Fixed by adding an `assertFinancePrivileged`
helper that loops over `["owner", "super_admin", "admin",
"finance_manager", "finance_ap", "finance_ar", "accountant"]` via the
`has_role` RPC and throws unless one matches. `src/server/admin.functions.ts`
here already has an equivalent guard (`assertCanAssignRoles`) for role
assignment — use it as the reference pattern for this package specifically.

Checklist before adding any new service-role-backed factory here:
- Does it approve/reject/complete/mark-paid/change status, or grant a
  role/permission?
- If so, does it check a specific role via `has_role`/an `is_*_staff` RPC
  or an established `assert*Privileged`/`assert*Role` helper — not just
  membership?
- If that check is missing, it's the same bug class as joabooks'
  `financeApprove`/`markPaymentRequestPaid` incident — and since this is
  shared code, the exposure is 4 apps wide, not 1.

# Security pattern: platform-wide identity mutations need full tenant coverage, not partial overlap

Any `create*` factory in `src/server/` that mutates a platform-wide
Supabase Auth identity field (email, phone, password, ban status) for a
user other than the caller must verify the caller manages **every**
tenant the target user belongs to — not just one shared tenant. Supabase
Auth is a single instance shared across all JoaSuite apps, so a check
based on partial tenant overlap lets an admin in one org hijack a user's
login and take over their account in unrelated orgs/apps. As with the
service-role-write pattern above, a gap here ships to every consuming app
at once (this factory is used directly by joaoffice/joasop, and joabooks/
joahr each carry an identical local copy).

Found and fixed 2026-07-28: `accountUpdateUserProfileServer` let a caller
who is owner/super_admin of just one tenant shared with a target user call
`supabaseAdmin.auth.admin.updateUserById(user_id, { email })` and change
that user's login email platform-wide, enabling account takeover in every
other tenant/app the target belongs to. Fixed by adding
`assertCallerCanChangeUserEmail`, called only when an email change is
requested, which requires the target's full tenant set to be a subset of
the caller's managed-tenant set — the existing tenant-scoped
`display_name`/`position` update path is unchanged.

Checklist before adding any new `supabaseAdmin.auth.admin.*` call for a
user other than the caller:
- Does it change email, phone, password, or ban status?
- If so, does it require the caller to manage the target's **entire**
  tenant set, not just a shared subset?
- If that check is missing, it's the same bug class as the
  `accountUpdateUserProfile` incident above — copy the
  `assertCallerCanChangeUserEmail` pattern rather than inventing a new one.

# Role/permission audit 2026-08-27: UserInvitePage.tsx is dead code — the real bugs live in each app's own local invite page

User pasted an external ("GPT") role/permission hardening plan and asked
for a code-grounded review before implementation. Investigating GPT's
"Invite preset privilege-escalation" claims led to discovering
`src/components/users/UserInvitePage.tsx` — the shared Invite UI
component with its own `applyPreset`/`rolesForApp` logic — is **not
imported by any of the 4 app repos** (joabooks/joaoffice/joasop/joahr each
hand-roll their own local `src/routes/app.people.invite.tsx` instead, with
`joabooks`/`joasop`/`joahr`'s copies byte-identical to what this component
had, and joaoffice's structurally different). Fixed the bugs here anyway
(for correctness / in case this component is ever wired up), but the
*actually live* fixes are in each app's own local file — see joabooks'
CLAUDE.md for the full audit writeup.

Fixed:
- `applyPreset`'s `"manager"` case fell back to `"super_admin"` for any
  app with no explicit mapping (joaoffice/joahr) instead of their real,
  lower-privilege `"manager"` role.
- `"field_tech"` granted joabooks `"approver"` (financial approval) by
  default — now `null`.
- `rolesForApp`'s unknown-app-code fallback
  (`?? ["owner","super_admin","approver"]`) now fails closed (`?? []`).
- `"owner_admin"`'s `rolesForApp(appCode)[0] ?? null` fallback (GPT's
  claimed "first role in array" escalation) removed — was unreachable
  dead code today (every real app's role array starts with `"owner"`),
  but removed as defense-in-depth for any future app added to
  `ROLES_BY_APP` without `"owner"` listed first.

`ROLES_BY_APP.joahr` was also found missing `payroll_manager`/
`scheduler`/`time_approver`/`read_only` — 4 real, `app_role`-enum-backed
roles JoaHR's own `joahr-access.ts` actively uses that were never exposed
in this shared catalog. Added.

# Library access control: allowed-roles allow-list, not a hierarchy — 2026-08-27

User asked for a per-Library-item access restriction ("visible to
everyone by default, but if you pick a role, only that role or above can
see it"). Before implementing, confirmed via `AskUserQuestion` that "role
or above" can't be built literally: this codebase has **no role hierarchy
anywhere** — every permission check (`has_role`/`has_any_role`/
`is_internal_staff`/etc.) is set-membership against a hardcoded role
list, never an ordered/ranked comparison (re-confirmed during the same
day's role/permission audit, see the entry above). The user chose an
explicit multi-select role allow-list over introducing a brand-new,
Library-only tier hierarchy that would exist nowhere else in the
codebase.

Also resolved without needing to ask: "visible to everyone" only ever
means internal tenant members. JoaBooks' `/app/documents` (Library) is
already unreachable by vendor/approver/customer portal users —
`app.tsx`'s route guard redirects `isVendor` away from any `/app/*` path
outside a small allow-list (`/app/payment-requests/*`, account pages),
and Library isn't in it; same shape for `isApprover`. So this feature
only ever needs to reason about internal-staff role rows, never
portal-flavored ones.

**Shipped**: `ContentItem.allowedRoles: string[]` (empty = unrestricted,
the default). `ContentMetadataPanel` gained a "Visible to" row (read-only:
"Everyone" or a badge list of role labels) and, in edit mode, a checkbox
grid of `ROLES_BY_APP[item.sourceApp]` — **owner/super_admin are
deliberately excluded from the checkbox list itself**, not because
they're denied, but because they always bypass this check regardless
(same convention as every other role gate in this schema), so listing
them as selectable would be misleading. `ContentMetadataPatch` gained
`allowedRoles?: string[]`, flowing through the existing generic
`onSaveMetadata` plumbing — no `ContentDetail`/`ContentMetadataPanel`
prop-surface change needed beyond the new field itself.

**Enforcement is in the DB, not just the UI** — see joabooks' CLAUDE.md
for the `user_can_view_content()` migration this depends on
(`content_items.allowed_roles`, checked before the existing
content_relations-based visibility logic, scoped to the item's own
`source_app` so a role granted in an unrelated app can't satisfy it).
That same migration also fixes a bug this feature's "visible to everyone
by default" premise depended on: a content_item with zero
`content_relations` (e.g. a freshly-uploaded Inbox item) previously
returned `false` for anyone but its creator — the opposite of "everyone
can see it by default." Fixed to return `is_tenant_member()` instead.
