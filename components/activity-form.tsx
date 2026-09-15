"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

export function ActivityForm() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");

    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(values.get("title") ?? ""),
          description: String(values.get("description") ?? ""),
          location: String(values.get("location") ?? ""),
          startsAt: String(values.get("startsAt") ?? ""),
          capacity: String(values.get("capacity") ?? ""),
        }),
      });
      const result = (await response.json()) as { error?: string; id?: string };
      if (!response.ok) {
        setError(result.error ?? "Nepavyko sukurti veiklos.");
        return;
      }
      router.push("/my-activities");
      router.refresh();
    } catch {
      setError("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="auth-card activity-form-card" aria-labelledby="new-activity-title">
      <h1 id="new-activity-title">Sukurti veiklą</h1>
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <label htmlFor="title">Pavadinimas</label>
        <input id="title" name="title" required maxLength={160} disabled={pending} />

        <label htmlFor="description">Aprašymas</label>
        <textarea id="description" name="description" rows={5} maxLength={2000} disabled={pending} />

        <label htmlFor="location">Vieta</label>
        <input id="location" name="location" required maxLength={200} disabled={pending} />

        <label htmlFor="startsAt">Data ir laikas</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required disabled={pending} />

        <label htmlFor="capacity">Vietų skaičius</label>
        <input id="capacity" name="capacity" type="number" min={1} step={1} required disabled={pending} />

        <button type="submit" disabled={pending}>
          {pending ? "Kuriama..." : "Sukurti veiklą"}
        </button>
        {error && <p className="message error" role="alert">{error}</p>}
      </form>
      <nav className="auth-links" aria-label="Veiklos kūrimo navigacija">
        <Link href="/my-activities">Grįžti į mano veiklas</Link>
      </nav>
    </section>
  );
}
