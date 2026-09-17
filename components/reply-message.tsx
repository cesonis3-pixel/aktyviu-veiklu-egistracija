"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ReplyMessage({ messageId, subject }: { messageId: string; subject: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    setNotice("");
    if (!message.trim() || Array.from(message).length > 2000) {
      setError("Įveskite atsakymą (iki 2000 simbolių).");
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, message }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Nepavyko išsiųsti atsakymo.");
        return;
      }
      setMessage("");
      setOpen(false);
      setNotice("Atsakymas išsiųstas.");
      router.refresh();
    } catch {
      setError("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <>
    {notice && <p role="status">{notice}</p>}
    <button type="button" className="button button-outline" aria-expanded={open}
      aria-controls={`reply-${messageId}`} disabled={pending} onClick={() => setOpen(!open)}>Atsakyti</button>
    {open && <form className="auth-form" id={`reply-${messageId}`} onSubmit={submit}>
      <p><strong>Originalios žinutės tema:</strong> {subject}</p>
      <label htmlFor={`reply-text-${messageId}`}>Atsakymas</label>
      <textarea id={`reply-text-${messageId}`} value={message} required rows={4}
        disabled={pending} onChange={event => setMessage(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Siunčiama..." : "Siųsti atsakymą"}</button>
    </form>}
  </>;
}
