import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Same pattern as app/api/conversations/_lib.ts — duplicated rather than
// shared, matching this codebase's existing convention of small,
// self-contained per-route-group helpers (e.g. getSupabaseAdmin is defined
// separately in both /api/ask and /api/stripe/webhook rather than in a
// shared lib).
function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

// Extracts the bearer token, verifies it against Supabase Auth (a genuine
// round-trip via getUser(jwt)), and returns a client already scoped to that
// user. user_memories only has select/delete RLS policies (see the routes
// below) — there's no insert policy, so this client could never be used to
// write a memory even if these routes tried to; inserts only happen via
// /api/ask's service-role client.
export async function authenticateRequest(
  req: Request
): Promise<{ userId: string; sb: SupabaseClient } | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const sb = getSupabaseForToken(token);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, sb };
}
