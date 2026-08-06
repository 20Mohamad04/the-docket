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
          // Raised from 2048: Sonnet 5 has adaptive thinking ON by default,
          // and thinking tokens count against this same budget alongside the
          // actual response text. With a tight cap, you can get a response
          // that's almost entirely internal reasoning with a truncated (or
          // missing) final answer. Extra headroom avoids that.
          max_tokens: 4096,
          // NOTE: Sonnet 5 rejects `temperature` (and top_p/top_k) with a hard
          // 400 error unless left at the default value — this is a real,
          // documented breaking change from earlier Sonnet models, not a bug.
          // Do NOT re-add a non-default temperature here. Behavior/consistency
          // that used to be tuned via temperature should be controlled through
          // the system prompt instead (which this route already does heavily).
          system,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Claude error:", data);
        throw new Error(data.error?.message ?? "Claude API error");
      }
      // IMPORTANT: with adaptive thinking on by default, data.content is an
      // array that may start with a "thinking" block before the real text
      // block — content[0] is no longer reliably the actual answer. Find the
      // first block that's actually type "text" instead of assuming position.
      const textBlock = Array.isArray(data.content)
        ? data.content.find((b: any) => b?.type === "text")
        : null;
      const content = textBlock?.text ?? "{}";
      return NextResponse.json({ content });
    }

    // Groq fallback — only used if ANTHROPIC_API_KEY isn't set (e.g. Claude API
    // outage or misconfiguration). Kept as a safety net, not the primary path.
    // Groq's OpenAI-compatible API still supports temperature normally and
    // doesn't have thinking blocks, so this one is untouched.
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
