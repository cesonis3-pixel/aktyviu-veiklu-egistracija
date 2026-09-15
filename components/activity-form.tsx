"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type ActivityFormData = {
  id?: string;
  title?: string;
  description?: string;
  location?: string;
  startsAt?: string;
  capacity?: number;
  organizer_name?: string;
};

export function ActivityForm({
  mode = "create",
  activity,
}: {
  mode?: "create" | "edit";
  activity?: ActivityFormData;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const isEdit = mode === "edit";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");

    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const payload = {
        title: String(values.get("title") ?? ""),
        description: String(values.get("description") ?? ""),
        location: String(values.get("location") ?? ""),
        startsAt: String(values.get("startsAt") ?? ""),
        capacity: String(values.get("capacity") ?? ""),
        organizer_name: String(values.get("organizer_name") ?? ""),
      };
      const response = await fetch(isEdit && activity?.id ? `/api/activities/${activity.id}` : "/api/activities", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; id?: string };
      if (!response.ok) {
        setError(result.error ?? (isEdit ? "Nepavyko atnaujinti veiklos." : "Nepavyko sukurti veiklos."));
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
      <h1 id="new-activity-title">{isEdit ? "Redaguoti veiklą" : "Sukurti veiklą"}</h1>
      <form className="auth-form" onSubmit={submit} aria-busy={pending}>
        <label htmlFor="title">Pavadinimas</label>
        <input id="title" name="title" required maxLength={160} defaultValue={activity?.title ?? ""} disabled={pending} />

        <label htmlFor="description">Aprašymas</label>
        <textarea id="description" name="description" rows={5} maxLength={2000} defaultValue={activity?.description ?? ""} disabled={pending} />

        <label htmlFor="location">Vieta</label>
        <input id="location" name="location" required maxLength={200} defaultValue={activity?.location ?? ""} disabled={pending} />

        <label htmlFor="startsAt">Data ir laikas</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={activity?.startsAt ?? ""} disabled={pending} />

        <label htmlFor="capacity">Vietų skaičius</label>
        <input id="capacity" name="capacity" type="number" min={1} step={1} required defaultValue={activity?.capacity ?? 1} disabled={pending} />

        <label htmlFor="organizer_name">Organizatoriaus pavadinimas</label>
        <input id="organizer_name" name="organizer_name" required maxLength={160} defaultValue={activity?.organizer_name ?? ""} disabled={pending} />

        <button type="submit" disabled={pending}>
          {pending ? (isEdit ? "Atnaujinama..." : "Kuriama...") : (isEdit ? "Atnaujinti veiklą" : "Sukurti veiklą")}
        </button>
        {error && <p className="message error" role="alert">{error}</p>}
      </form>
      <nav className="auth-links" aria-label="Veiklos kūrimo navigacija">
        <Link href="/my-activities">Grįžti į mano veiklas</Link>
      </nav>
    </section>
  );
}
