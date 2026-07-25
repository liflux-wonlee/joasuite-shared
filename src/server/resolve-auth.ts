import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export type ResolvedAuth = { supabase: any; userId: string; claims: any };

/**
 * Duplicates each app's generated `requireSupabaseAuth` middleware logic
 * (parse+validate the Bearer token, build a request-scoped Supabase client)
 * as a plain function instead of a TanStack Start middleware. Confirmed in
 * production (org-structure.functions.ts's diagnostic guard): the
 * `.middleware([deps.requireSupabaseAuth])` -> `context.supabase`/
 * `context.userId` handoff can arrive at the handler as an empty object
 * despite the middleware chain being correctly wired in source -- a
 * cross-middleware context-threading failure that resisted multiple rounds
 * of source-level review because the source is correct; the break is in
 * the runtime handoff itself. Calling this directly inside a handler body
 * (the same pattern auth-mfa.functions.ts's `reqMeta()` already uses
 * successfully via a bare `getRequest()` call) sidesteps that mechanism
 * entirely instead of depending on it.
 */
export async function resolveSupabaseAuthDirect(): Promise<ResolvedAuth> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      !SUPABASE_URL ? "SUPABASE_URL" : null,
      !SUPABASE_PUBLISHABLE_KEY ? "SUPABASE_PUBLISHABLE_KEY" : null,
    ].filter(Boolean);
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`,
    );
  }

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized: No token provided");

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
  if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

  return { supabase, userId: data.claims.sub as string, claims: data.claims };
}

/**
 * Prefer the request-scoped client/userId the `.middleware([deps.requireSupabaseAuth])`
 * chain injected into `context`; if that came back empty, resolve directly
 * off the current request instead of failing. Use at the top of every
 * handler that currently reads `(context as any).supabase`/`.userId`.
 */
export async function ensureAuthContext(context: any): Promise<ResolvedAuth> {
  if (context && context.supabase && context.userId !== undefined && context.userId !== null) {
    return { supabase: context.supabase, userId: context.userId, claims: context.claims };
  }
  return resolveSupabaseAuthDirect();
}
