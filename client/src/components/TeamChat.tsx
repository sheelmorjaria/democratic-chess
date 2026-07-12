"use client";

import { useState } from "react";

export interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  at: string;
}

interface TeamChatProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
}

export default function TeamChat({ messages, onSend }: TeamChatProps) {
  const [text, setText] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <section style={{ border: "1px solid #ccc", padding: "0.75rem", minWidth: 240 }}>
      <h3>Team chat</h3>
      <ul style={{ listStyle: "none", padding: 0, maxHeight: 200, overflowY: "auto" }}>
        {messages.length === 0 && <li style={{ color: "#999" }}>No messages yet.</li>}
        {messages.map((m, i) => (
          <li key={i}>
            <strong>{m.username}:</strong> {m.message}
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message your team" />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
