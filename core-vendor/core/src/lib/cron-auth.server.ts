// Shared cron / webhook auth helpers. Server-only.
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verifies a request carries the shared cron secret in the `x-cron-secret`
 * header (timing-safe). Returns null on success, or a Response to return on
 * failure. Use at the top of every `/api/public/hooks/*` POST handler that
 * must only be invoked by pg_cron or another trusted scheduler.
 */
export function verifyCronSecret(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server not configured (CRON_SECRET missing)" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided || !safeEqual(provided, secret)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}
