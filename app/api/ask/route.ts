import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const systemPrompt = {
      role: "system",
      content: "You are Ask Docket, an AI assistant inside a task management app. The user will give you instructions. You must output STRICT JSON with two keys: 'reply' (a short string to show the user) and 'action' (an object containing the task details). Valid action types: { type: 'add_task', title: string, category: string, priority: string }. Categories: Study, Trading & Investing, Business, Career, Health, Admin & Housing, Faith. Priorities: Medium, High, Urgent. If the user is just chatting, set action to null. Example: User says 'add a task to buy groceries', you reply: {\"reply\":\"Okay, I added that to your list.\",\"action\":{\"type\":\"add_task\",\"title\":\"Buy Groceries\",\"category\":\"Admin & Housing\",\"priority\":\"Medium\"}}"
    };

    const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "phi3",
        stream: false,
        messages: [systemPrompt, ...messages]
      })
    });

    const data = await ollamaRes.json();

    try {
      const parsed = JSON.parse(data.message.content);
      return NextResponse.json(parsed);
    } catch (e) {
      return NextResponse.json({ reply: data.message.content, action: null });
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to connect to AI" }, { status: 500 });
  }
}