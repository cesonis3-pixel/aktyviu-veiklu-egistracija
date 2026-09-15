"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";

function reservationMessage(error: string) {
  if (error.includes("Vietų nebeliko") || error.includes("Laisvų vietų")) return "Vietų nebeliko.";
  if (error.includes("jau rezervavote") || error.includes("jau turite rezervaciją")) return "Jūs jau turite rezervaciją šiai veiklai";
  if (error.includes("nebepriima") || error.includes("atšaukta")) return "Ši veikla atšaukta.";
  if (error.includes("Prisijung")) return "Norint rezervuoti vietą reikia prisijungti.";
  return error || "Rezervacijos nepavyko pakeisti.";
}

export function ActivityDetail({
  activity,
  signedIn,
  currentUserId,
  isOwner: ownerOverride = false,
}: {
  activity: Activity;
  signedIn: boolean;
  currentUserId?: string | null;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const isOwner = currentUserId !== undefined
    ? Boolean(currentUserId && currentUserId === activity.creator_id)
    : ownerOverride;
  const [notice, setNotice] = useState("");
  const [reserved, setReserved] = useState(Boolean(activity.isReserved));
  const [available, setAvailable] = useState(activity.available);
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [messageFormOpen, setMessageFormOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const messageInFlight = useRef(false);
  const inFlight = useRef(false);
  const busy = pending || refreshing;
  const cancelled = activity.status === "cancelled";

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch(`/api/reservations?activityId=${encodeURIComponent(activity.id)}`)
      .then((response) => response.json())
      .then((data: { reserved?: boolean }) => {
        if (active) setReserved(Boolean(data.reserved));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activity.id, signedIn]);

  async function changeReservation(method: "POST" | "DELETE") {
    if (inFlight.current || busy || !signedIn) return;
    if (cancelled || (method === "POST" && (reserved || available <= 0))) return;
    inFlight.current = true;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const result = (await response.json()) as { available?: number; error?: string };
      if (!response.ok) {
        const message = reservationMessage(result.error ?? "");
        setNotice(message);
        if (response.status === 401) router.push("/login");
        if (response.status === 409) {
          setReserved(false);
          startTransition(() => router.refresh());
        }
        return;
      }
      if (method === "POST") {
        setReserved(true);
        if (typeof result.available === "number") setAvailable(result.available);
        setNotice("Vieta rezervuota");
      } else {
        setReserved(false);
        setAvailable((current) => current + 1);
        setNotice("Rezervacija atšaukta.");
      }
      startTransition(() => router.refresh());
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn || isOwner || sending || messageInFlight.current) return;
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      setNotice("Tema ir žinutė yra privalomi.");
      return;
    }
    messageInFlight.current = true;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id, subject: trimmedSubject, message: trimmedMessage }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko išsiųsti žinutės.");
        return;
      }
      setMessageFormOpen(false);
      setSubject("");
      setMessage("");
      setNotice("Žinutė išsiųsta veiklos organizatoriui.");
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      messageInFlight.current = false;
      setSending(false);
    }
  }

  async function deleteActivity() {
    if (!isOwner || deleting) return;
    setDeleting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko ištrinti veiklos.");
        return;
      }
      router.push("/my-activities");
      router.refresh();
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function cancelActivity() {
    if (!isOwner || cancelled || deleting) return;
    setDeleting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/activities/${activity.id}/cancel`, { method: "POST" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko atšaukti veiklos.");
        return;
      }
      setNotice("Veikla atšaukta.");
      router.refresh();
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="detail-card">
      <div className="detail-image">
        <Image src={activity.image} alt={activity.imageAlt} fill preload sizes="(max-width: 1200px) 100vw, 1160px" />
        <span className="category-badge">{activity.category}</span>
      </div>
      <div className="detail-content">
        <div className="detail-heading">
          <h1>{activity.title}</h1>
          <span className={`place-badge ${cancelled || available === 0 ? "is-full" : ""}`}>{cancelled ? "Veikla atšaukta" : `Laisvų vietų: ${available}`}</span>
        </div>
        <ul className="activity-meta detail-meta">
          <li><Icon name="calendar" /><time dateTime={activity.date}>{activity.dateLabel}</time></li>
          <li><Icon name="pin" />{activity.location}</li>
        </ul>
        <div className="detail-columns">
          <section><h2>Apie veiklą</h2><p>{activity.description}</p></section>
          <aside className="organizer">
            <span className="organizer-avatar"><Icon name="user" /></span>
            <div><span className="muted">Organizatorius</span><h2>{activity.organizer_name?.trim() || "Organizatorius"}</h2><p>Žiemos nuotykių entuziastas</p></div>
          </aside>
        </div>
        {isOwner ? (
          <section className="activity-management" aria-labelledby="activity-management-title">
            <h2 id="activity-management-title">Veiklos valdymas</h2>
            <div className="confirmation-actions">
              <Link className="button" href={`/my-activities/${activity.id}/edit`}>Redaguoti</Link>
              {!cancelled && (
                <button type="button" className="button button-outline" onClick={cancelActivity} disabled={deleting}>
                  {deleting ? "Atšaukiama..." : "Atšaukti veiklą"}
                </button>
              )}
              {!confirmingDelete ? (
                <button type="button" className="button button-outline" onClick={() => setConfirmingDelete(true)} disabled={deleting}>Ištrinti veiklą</button>
              ) : (
                <div className="activity-confirmation" role="alertdialog" aria-labelledby="detail-delete-title">
                  <h3 id="detail-delete-title">Ar tikrai norite ištrinti šią veiklą?</h3>
                  <p>Šio veiksmo atšaukti negalima. Jei veikla turi aktyvių rezervacijų, serveris trynimą atmes.</p>
                  <div className="confirmation-actions">
                    <button type="button" onClick={deleteActivity} disabled={deleting}>{deleting ? "Trinama..." : "Patvirtinti trynimą"}</button>
                    <button type="button" className="button button-outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Atšaukti</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}
        <div className="reservation-panel" id="reservation">
          <div>
            <h2>{cancelled ? "Veikla atšaukta" : reserved ? "Tavo vieta rezervuota" : available > 0 ? "Prisijunk prie nuotykio" : "Visos vietos užimtos"}</h2>
            <p>{cancelled ? "Organizatorius atšaukė veiklą. Naujos rezervacijos nebepriimamos. Esamos rezervacijos išlieka skiltyje „Mano rezervacijos“." : "Rezervacija išsaugoma tavo paskyroje."}</p>
          </div>
          {cancelled ? (
            <button type="button" disabled>Veikla atšaukta</button>
          ) : reserved ? (
            <button type="button" className="button button-outline" disabled={busy} onClick={() => changeReservation("DELETE")}>{busy ? "Atšaukiama..." : "Atšaukti rezervaciją"}</button>
          ) : available === 0 ? (
            <button type="button" disabled>Pilna</button>
          ) : signedIn ? (
            <button type="button" disabled={busy} onClick={() => changeReservation("POST")}>{busy ? "Rezervuojama..." : "Registruoti vietą"} <Icon name="arrow" /></button>
          ) : (
            <Link className="button" href="/login">Registruoti vietą <Icon name="arrow" /></Link>
          )}
        </div>
        {!cancelled && !signedIn && available > 0 && <p className="activity-note">Norint rezervuoti vietą reikia prisijungti.</p>}
        {signedIn && !isOwner && (
          <div className="activity-message-actions">
            {!messageFormOpen ? (
              <button type="button" className="button button-outline" onClick={() => setMessageFormOpen(true)}>Parašyti organizatoriui</button>
            ) : (
              <form className="auth-form" onSubmit={sendMessage}>
                <label htmlFor="message-subject">Tema</label>
                <input id="message-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={120} disabled={sending} />
                <label htmlFor="message-body">Žinutė</label>
                <textarea id="message-body" rows={5} value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={2000} disabled={sending} />
                <div className="confirmation-actions">
                  <button type="submit" disabled={sending}>{sending ? "Siunčiama..." : "Siųsti"}</button>
                  <button type="button" className="button button-outline" onClick={() => { setMessageFormOpen(false); setSubject(""); setMessage(""); }} disabled={sending}>Atšaukti</button>
                </div>
              </form>
            )}
          </div>
        )}
        <p role="status" className="reservation-notice">{notice}</p>
      </div>
    </article>
  );
}
