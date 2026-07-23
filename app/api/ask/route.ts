import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const systemPrompt = {
      role: "system",
      content: `You are Ask Docket, an AI assistant inside a task management app.
      You MUST output ONLY a valid JSON object. 
      The JSON object MUST have exactly two keys: "reply" and "action".
      
      "reply" must be a short, friendly string.
      "action" must be an object containing the task details, OR null if the user is just chatting.
      
      If the user wants to add a task, "action" MUST be formatted exactly like this:
      {"type": "add_task", "title": "User's Task", "category": "Category", "priority": "Priority"}
      
      Valid Categories: "Study", "Trading & Investing", "Business", "Career", "Health", "Admin & Housing", "Faith".
      Valid Priorities: "Medium", "High", "Urgent".
      
      Example 1:
      User: "Add a task to buy groceries"
      Output: {"reply": "Okay, I added that to your list!", "action": {"type": "add_task", "title": "Buy Groceries", "category": "Admin & Housing", "priority": "Medium"}}
      
      Example 2:
      User: "Hello"
      Output: {"reply": "Hi there! How can I help you manage your tasks today?", "action": null}`
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192", // Upgraded to the much smarter 70B model!
        messages: [systemPrompt, ...messages],
        response_format: { type: "json_object" }
      })
    });

    const data = await groqRes.json();
    const content = data.choices[0].message.content;

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