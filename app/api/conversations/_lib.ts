import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// User-scoped client, authenticated with the caller's own Supabase access
// token instead of the service-role key — so Postgres RLS on
// conversations/chat_messages genuinely applies (auth.uid() resolves to
// this user), the same way it already does for tasks/routines when the
// browser talks to Supabase directly. This is what makes these routes
// trustworthy without re-implementing ownership checks by hand. /api/ask
// still uses a service-role client (see its own auth check for why: it
// needs to write on the caller's behalf via a verified-but-not-RLS-scoped
// userId), but verifies the same bearer token before trusting that id.
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
// round-trip via getUser(jwt) — not just decoding the token locally), and
// returns a client already scoped to that user. Returns null if the
// request isn't authenticated; every route below returns 401 in that case.
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

// Removes every stored image under the given conversations' folders (path
// convention: {user_id}/{conversation_id}/{filename}, matching what
// /api/ask uploads to). Best-effort — logs and continues rather than
// blocking the actual conversation deletion, since an orphaned storage
// object is a far smaller problem than a user being unable to delete their
// own chat history.
export async function removeStoredImages(
  sb: SupabaseClient,
  userId: string,
  conversationIds: string[]
): Promise<void> {
  for (const conversationId of conversationIds) {
    try {
      const folder = `${userId}/${conversationId}`;
      const { data: files, error: listError } = await sb.storage.from("chat-images").list(folder);
      if (listError) {
        console.error(`Failed to list chat images for ${folder}:`, listError);
        continue;
      }
      if (files && files.length > 0) {
        const paths = files.map((f) => `${folder}/${f.name}`);
        const { error: removeError } = await sb.storage.from("chat-images").remove(paths);
        if (removeError) console.error(`Failed to remove chat images for ${folder}:`, removeError);
      }
    } catch (err) {
      console.error(`Removing chat images for conversation ${conversationId} threw:`, err);
    }
  }
}
