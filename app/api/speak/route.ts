import { NextResponse } from "next/server";

export async function POST(req: Request) {
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