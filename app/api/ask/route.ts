import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { system, messages } = await req.json();

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not set." }, { status: 500 });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        temperature: 0.2,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
      }),
    });

    const data = await groqRes.json();

    if (!data.choices || data.choices.length === 0) {
      console.error("Groq API Error:", data);
      return NextResponse.json(
        { error: JSON.stringify(data.error || data) },
        { status: 500 }
      );
    }

    const content = data.choices[0].message.content;
    return NextResponse.json({ content });

  } catch (error) {
    console.error("Route Error:", error);
    return NextResponse.json({ error: "Failed to connect to AI" }, { status: 500 });
  }
}