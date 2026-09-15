"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";
import { useRouter } from "next/navigation";

export function ActivityDetail({ activity, signedIn }: { activity: Activity; signedIn: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const isReserved = activity.isReserved;
  const available = activity.available;
  async function reserve() {
    if (pending || !signedIn || (!isReserved && available <= 0)) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method: isReserved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Nepavyko pakeisti rezervacijos.");
      setNotice(isReserved ? "Rezervacija atšaukta." : "Vieta rezervuota.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Nepavyko pakeisti rezervacijos.");
    } finally {
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
              disabled={pending}
              onClick={reserve}
            >
              Atšaukti rezervaciją
            </button>
          ) : available === 0 ? (
            <button type="button" disabled>
              Pilna
            </button>
          ) : signedIn ? (
            <button type="button" disabled={pending}
              onClick={reserve}>
              Registruoti vietą <Icon name="arrow" />
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
