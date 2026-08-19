import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Same pattern as app/api/ask/route.ts — verifies the caller's own Supabase
// access token rather than allowing anonymous requests, which this route
// used to: anyone could POST arbitrary text and spend our ElevenLabs quota
// with no authentication at all.
function getSupabaseForToken(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}

async function authenticateRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const sb = getSupabaseForToken(token);
  if (!sb) return false;
  const { data, error } = await sb.auth.getUser(token);
  return !error && !!data?.user;
}

export async function POST(req: Request) {
  if (!(await authenticateRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { text } = await req.json();

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
    return NextResponse.json(
      { error: `ElevenLabs error: ${errorText}` },
      { status: res.status }
    );
  }

  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}