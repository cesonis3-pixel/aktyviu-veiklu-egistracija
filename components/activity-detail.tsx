"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";
import { useRouter } from "next/navigation";

export function ActivityDetail({ activity, signedIn }: { activity: Activity; signedIn: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const inFlight = useRef(false);
  const busy = pending || refreshing;
  const isReserved = activity.isReserved;
  const available = activity.available;
  async function reserve() {
    if (inFlight.current || busy || !signedIn || (!isReserved && available <= 0)) return;
    inFlight.current = true;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method: isReserved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko pakeisti rezervacijos. Bandykite dar kartą.");
        if (response.status === 401) router.push("/login");
        if (response.status === 409) startTransition(() => router.refresh());
        return;
      }
      setNotice(isReserved ? "Rezervacija atšaukta." : "Vieta rezervuota.");
      startTransition(() => router.refresh());
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <article className="detail-card">
      <div className="detail-image">
        <Image
          src={activity.image}
          alt={activity.imageAlt}
          fill
          preload
          sizes="(max-width: 1200px) 100vw, 1160px"
        />
        <span className="category-badge">{activity.category}</span>
      </div>
      <div className="detail-content">
        <div className="detail-heading">
          <h1>{activity.title}</h1>
          <span className={`place-badge ${available === 0 ? "is-full" : ""}`}>
            Laisvų vietų: {available}
          </span>
        </div>
        <ul className="activity-meta detail-meta">
          <li>
            <Icon name="calendar" />
            <time dateTime={activity.date}>{activity.dateLabel}</time>
          </li>
          <li>
            <Icon name="pin" />
            {activity.location}
          </li>
        </ul>
        <div className="detail-columns">
          <section>
            <h2>Apie veiklą</h2>
            <p>{activity.description}</p>
          </section>
          <aside className="organizer">
            <span className="organizer-avatar">
              <Icon name="user" />
            </span>
            <div>
              <span className="muted">Organizatorius</span>
              <h2>{activity.organizer}</h2>
              <p>Žiemos nuotykių entuziastas</p>
            </div>
          </aside>
        </div>
        <div className="reservation-panel" id="reservation">
          <div>
            <h2>
              {isReserved
                ? "Tavo vieta rezervuota"
                : available > 0
                  ? "Prisijunk prie nuotykio"
                  : "Visos vietos užimtos"}
            </h2>
            <p>Rezervuok vietą arba atšauk savo rezervaciją.</p>
          </div>
          {isReserved ? (
            <button
              type="button"
              className="button button-outline"
              disabled={busy}
              onClick={reserve}
            >
              {busy ? "Atšaukiama..." : "Atšaukti rezervaciją"}
            </button>
          ) : available === 0 ? (
            <button type="button" disabled>
              Pilna
            </button>
          ) : signedIn ? (
            <button type="button" disabled={busy}
              onClick={reserve}>
              {busy ? "Rezervuojama..." : "Registruoti vietą"} <Icon name="arrow" />
            </button>
          ) : (
            <Link className="button" href="/login">
              Registruoti vietą <Icon name="arrow" />
            </Link>
          )}
        </div>
        {!signedIn && available > 0 && (
          <p className="activity-note">
            Norėdamas rezervuoti vietą, prisijunk prie paskyros.
          </p>
        )}
        <p role="status" className="reservation-notice">
          {notice}
        </p>
      </div>
    </article>
  );
}
