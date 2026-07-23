"use client";
import React, { useState } from 'react';

interface ChatbotProps {
  onAiAction: (data: any) => void;
}

export default function Chatbot({ onAiAction }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hi, I'm Ask Docket. Tell me what to do! (e.g., 'Add a task to check Apple stock')" }]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call our local AI API route
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });
      const data = await res.json();
      
      // Add AI reply to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      
      // If AI returns an action, execute it!
      if (data.action) {
        onAiAction(data.action);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect to the AI." }]);
    }
    setIsLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--color-primary-accent)] text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-bold z-50 hover:scale-105 transition-transform"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-[var(--color-surface)] rounded-[14px] border border-[var(--color-border)] shadow-xl flex flex-col z-50 overflow-hidden">
          <div className="bg-[var(--color-navy)] text-white p-3 font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Ask Docket</div>
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            {messages.map((msg, idx) => (
              <div key={idx} className={`text-sm p-2 rounded-lg ${msg.role === 'user' ? 'bg-[var(--color-primary-accent)] text-white text-right' : 'bg-[var(--color-surface-2)] text-[var(--color-navy)]'}`}>
                {msg.content}
              </div>
            ))}
            {isLoading && <div className="text-sm text-[var(--color-muted)] text-center">Thinking...</div>}
          </div>
          <div className="p-3 border-t border-[var(--color-border)] flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a command..." 
              className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-accent)]"
            />
            <button onClick={handleSend} className="bg-[var(--color-navy)] text-white px-3 py-2 rounded-md text-sm">Send</button>
          </div>
        </div>
      )}
    </>
  );
}