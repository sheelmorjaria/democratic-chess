"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const [meId, setMeId] = useState<string | null>(null);
  const feedRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setMeId((JSON.parse(stored) as { id: string }).id);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep the latest message in view.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <section className="dc-card dc-chat" style={{ minWidth: 280, flex: "1 1 300px", maxWidth: 340 }}>
      <h2 className="dc-card__title">Team chat</h2>
      <ul ref={feedRef} className="dc-chat__feed" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
        {messages.map((m, i) => {
          const me = meId != null && m.userId === meId;
          return (
            <li key={i} className={`dc-chat__msg${me ? " dc-chat__msg--me" : ""}`}>
              <div className="dc-chat__who">{m.username}</div>
              <div>{m.message}</div>
            </li>
          );
        })}
      </ul>
      <form onSubmit={submit} className="dc-chat__form">
        <input
          className="dc-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your team"
        />
        <Button type="submit" variant="primary">
          Send
        </Button>
      </form>
    </section>
  );
}
