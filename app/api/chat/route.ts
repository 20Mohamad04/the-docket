import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { message } = await req.json();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 250,
      system: "You are a mystical AI orb. Be concise and wise. Under 50 words.",
      messages: [{ role: "user", content: message }],
    }),
  });

  const data = await res.json();
  return NextResponse.json({ text: data.content[0].text });
}