import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { system, messages } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    // Claude Sonnet 5 — meaningfully stronger reasoning and instruction-following
    // than Haiku, which matters a lot here: the system prompt asks the model to
    // make judgment calls (when to ask a clarifying question vs just act, how to
    // read an ambiguous request, how to explain what it did in its own words).
    // Haiku is fast and cheap but not built for that kind of nuanced judgment.
    if (apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2048,
          temperature: 0.3, // low — favors reliable, consistent JSON + focused replies over creative variance
          system,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Claude error:", data);
        throw new Error(data.error?.message ?? "Claude API error");
      }
      const content = data.content?.[0]?.text ?? "{}";
      return NextResponse.json({ content });
    }

    // Groq fallback — only used if ANTHROPIC_API_KEY isn't set (e.g. Claude API
    // outage or misconfiguration). Kept as a safety net, not the primary path.
    if (groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          max_tokens: 1500,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.choices?.length) {
        console.error("Groq error:", data);
        throw new Error(data.error?.message ?? "Groq API error");
      }
      const content = data.choices[0].message.content;
      return NextResponse.json({ content });
    }

    return NextResponse.json(
      { content: '{"actions":[],"reply":"No AI API key configured. Add ANTHROPIC_API_KEY in Vercel environment variables."}' },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Ask route error:", err);
    return NextResponse.json(
      { content: '{"actions":[],"reply":"Something went wrong on my end — try rephrasing, or try again in a moment."}' },
      { status: 200 }
    );
  }
}