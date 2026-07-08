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
