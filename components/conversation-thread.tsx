"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { messageTime, type ConversationMessage } from "@/lib/conversations";

export function ConversationThread({ messages, currentUserId, anchorId }: {
  messages: ConversationMessage[]; currentUserId: string; anchorId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const busy = pending || refreshing;
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [messages]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || busy) return;
    setError(""); setNotice("");
    if (!message.trim() || Array.from(message).length > 2000) {
      setError("Įveskite žinutę (iki 2000 simbolių)."); return;
    }
    inFlight.current = true; setPending(true);
    try {
      const response = await fetch("/api/messages/conversation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: anchorId, message }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Nepavyko išsiųsti žinutės."); return; }
      setMessage(""); setNotice("Žinutė išsiųsta.");
      startTransition(() => router.refresh());
    } catch { setError("Nepavyko susisiekti su serveriu. Bandykite dar kartą."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <>
    <div ref={history} className="conversation-history" role="log" aria-label="Pokalbio istorija">
      {messages.map(item => <div key={item.id} className={`message-row ${item.sender_id === currentUserId ? "message-own" : "message-other"}`}>
        <div className="message-bubble"><p>{item.message}</p><time dateTime={item.created_at}>{messageTime(item.created_at)}</time></div>
      </div>)}
    </div>
    <form className="conversation-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="conversation-message">Žinutė</label>
      <textarea id="conversation-message" placeholder="Rašyti žinutę..." rows={2} required value={message} disabled={busy}
        onChange={event => setMessage(event.target.value)} aria-describedby="conversation-feedback" />
      <button type="submit" disabled={busy}>{busy ? "Siunčiama..." : "Siųsti"}</button>
      <div id="conversation-feedback" className="conversation-feedback">
        {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      </div>
    </form>
  </>;
}
