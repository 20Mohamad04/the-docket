import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Same pattern as app/api/ask/route.ts — verifies the caller's own Supabase
// access token rather than allowing anonymous requests, which this route
// used to: anyone could POST arbitrary text and spend our ElevenLabs quota
// with no authentication at all. Returns the verified user id (not just a
// boolean) since reserve_speak below needs it.
function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const sb = getSupabaseForToken(token);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Service-role client — bypasses RLS. Server-only; same pattern as
// app/api/ask/route.ts's getSupabaseAdmin (duplicated rather than shared,
// matching this codebase's convention of small, self-contained
// per-route-group helpers).
function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_TEXT_LENGTH = 2500;
const DAILY_MAX_REQUESTS = 200;
const DAILY_MAX_CHARS = 60000;

export async function POST(req: Request) {
  const userId = await authenticateRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Text too long" }, { status: 413 });
  }

  // Reserve BEFORE calling ElevenLabs — reserve_speak atomically rolls over
  // the user's daily (UTC) row and increments both counters only if still
  // under both limits, so there's no read-then-write race the way the old
  // Nova/Vega usage check used to have (see S-02 in SECURITY_AUDIT.md).
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.error("Speak route: Supabase admin client unavailable — failing closed");
    return NextResponse.json({ error: "Voice unavailable" }, { status: 503 });
  }
  const { data: reserved, error: reserveError } = await sb.rpc("reserve_speak", {
    p_user_id: userId,
    p_chars: text.length,
    p_max_requests: DAILY_MAX_REQUESTS,
    p_max_chars: DAILY_MAX_CHARS,
  });
  if (reserveError) {
    // Fail closed: an RPC failure must never be treated as "room available" —
    // never let a request through unmetered.
    console.error("reserve_speak RPC failed:", reserveError);
    return NextResponse.json({ error: "Voice unavailable" }, { status: 503 });
  }
  if (!reserved) {
    return NextResponse.json({ error: "Daily voice limit reached" }, { status: 429 });
  }

  const VOICE_ID = "EdRF4OLfMKecDfuWuBXY";

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text,
        // eleven_monolingual_v1 was deprecated by ElevenLabs (400 "unsupported_model")
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("ElevenLabs error:", res.status, errorText);
    // Deliberately no release step on this failure — a failed ElevenLabs call still uses its reserved slot.
    return NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
  }

  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}
