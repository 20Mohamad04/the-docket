import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const systemPrompt = {
      role: "system",
      content: "You are Ask Docket, an AI assistant inside a task management app. The user will give you instructions. You must output STRICT JSON with two keys: 'reply' (a short string to show the user) and 'action' (an object containing the task details). Valid action types: { type: 'add_task', title: string, category: string, priority: string }. Categories: Study, Trading & Investing, Business, Career, Health, Admin & Housing, Faith. Priorities: Medium, High, Urgent. If the user is just chatting, set action to null. Example: User says 'add a task to buy groceries', you reply: {\"reply\":\"Okay, I added that to your list.\",\"action\":{\"type\":\"add_task\",\"title\":\"Buy Groceries\",\"category\":\"Admin & Housing\",\"priority\":\"Medium\"}}"
    };

    // Call Groq API
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", // Fast, smart open-source model
        messages: [systemPrompt, ...messages],
        response_format: { type: "json_object" } // Forces strict JSON
      })
    });

    const data = await groqRes.json();
    const content = data.choices[0].message.content;

    // Parse the AI's JSON response
    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch (e) {
      return NextResponse.json({ reply: content, action: null });
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to connect to AI" }, { status: 500 });
  }
}