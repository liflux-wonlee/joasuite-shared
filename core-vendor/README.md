# core-vendor

Copy-vendored shared files for JoaSuite apps — the counterpart to `../src`
(the real `@joasuite/shared-ui` npm package) for code that doesn't fit a
dependency-injection package: plain utilities not yet worth a package export,
and domain business logic too tightly coupled to one app's tables/UI to
factor into a DI-injectable server function.

This folder is **not** built or published. Nothing here is imported by
`../src`. It exists purely so `scripts/push-to-core.sh` /
`pull-from-core.sh` can copy files between app repos without each app
re-describing the same feature to an LLM (which is what caused the original
drift this replaces — see `manifest.txt` history).

This supersedes the standalone `joasuite-core` repo, which is deprecated.

## Layout

- `manifest.txt` — file paths (relative to an app repo root) considered core.
- `core/` — the vendored copies, mirroring app-relative paths.
- `scripts/push-to-core.sh <app-repo-path>` — copy FROM an app repo INTO `core/`.
- `scripts/pull-from-core.sh <app-repo-path>` — copy FROM `core/` INTO an app repo.
- `scripts/drift-check.sh <app-repo-path>` — compare without changing anything.

## Workflow

Same as `../README.md` Phase 1 workflow for the package: canonical source is
JoaBooks. Push from JoaBooks, review the diff, commit here, then pull into
every other app and review/commit there. When another app needs to change a
vendored file, treat it like an upstream PR: change it in that app, push here,
check it doesn't break other apps, commit, then have every app (including the
one that changed it) pull so this repo stays the single source of truth.

## Graduating a file out of core-vendor

If a file here turns out to have zero app-specific coupling (pure function,
no supabase/auth/router imports), prefer moving it into `../src` as a real
package export instead of leaving it copy-vendored — that removes the manual
sync step entirely. `timezone.ts`, `format.ts`, `utils.ts`, `error-capture.ts`,
and `error-page.ts` are flagged as candidates for this in `manifest.txt`.
