/**
 * Small, dependency-free helpers shared by every app's Shared Content Core
 * integration. Deliberately NOT `createServerFn()` factories -- these are
 * plain, synchronous validation functions with no Supabase/DI involvement
 * at all, so (like `ACCOUNT_APP_ROLES`) they're safe to import and call
 * directly from app code. They carry none of the "createServerFn() must be
 * called app-local" risk documented in every app repo's CLAUDE.md, since
 * there is no createServerFn() call site here to lose its closure.
 *
 * Canonical source: JoaOffice's `document-vault.functions.ts` (the first
 * Content Core external-link writer). Promoted here once JoaBooks' own
 * File Library needed the identical scheme guard -- see each app's own
 * `assertSafeExternalUrl` call site for how it's used.
 */

const ALLOWED_LINK_SCHEMES = new Set(["http:", "https:"]);

/**
 * Validates a user-supplied external link URL before it's stored as a
 * content_versions.external_url (or an app-specific external-link field).
 * The URL is never fetched -- only its scheme is checked -- but rejecting
 * a dangerous scheme (javascript:/data:/file:/etc.) here means no
 * downstream consumer that later renders the link has to remember to
 * re-check it themselves. Throws on an invalid URL or an unsupported
 * scheme; returns the normalized URL string otherwise.
 */
export function assertSafeExternalUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Not a valid URL");
  }
  if (!ALLOWED_LINK_SCHEMES.has(url.protocol)) {
    throw new Error(`Unsupported URL scheme "${url.protocol}" -- only http/https links are allowed`);
  }
  return url.toString();
}
