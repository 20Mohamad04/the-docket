import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { system, messages } = await req.json();

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.error("Missing GROQ_API_KEY");
      return NextResponse.json({ content: '{"actions":[],"reply":"Server config error: no API key."}' }, { status: 500 });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 512,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      }),
    });

    const data = await groqRes.json();
    console.log("Groq status:", groqRes.status);
    console.log("Groq response:", JSON.stringify(data).slice(0, 500));

    if (!groqRes.ok || !data.choices || data.choices.length === 0) {
      console.error("Groq error:", data);
      // Return a fallback so the frontend doesn't break
      return NextResponse.json({
        content: `{"actions":[],"reply":"Groq error: ${data.error?.message ?? "unknown error"}"}`
      });
    }

    const content = data.choices[0].message.content;
    console.log("Groq content:", content);
    return NextResponse.json({ content });

  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json({
      content: '{"actions":[],"reply":"Server error — please try again."}'
    });
  }
}