"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/demo-activities";
import { Icon } from "./icon";
import { useDemoReservations } from "./demo-reservations";

export function ActivityDetail({ activity }: { activity: Activity }) {
  const { signedIn, reserved } = useDemoReservations();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [databaseReserved, setDatabaseReserved] = useState(false);
  const [pending, setPending] = useState(false);
  const isReserved = signedIn ? databaseReserved : reserved.includes(activity.id);
  const available = activity.available - (isReserved ? 1 : 0);
  useEffect(() => {
    if (!signedIn) return;
    fetch(`/api/reservations?activityId=${encodeURIComponent(activity.id)}`)
      .then((response) => response.json())
      .then((result: { reserved?: boolean }) =>
        setDatabaseReserved(Boolean(result.reserved)),
      )
      .catch(() => setNotice("Nepavyko patikrinti rezervacijos būsenos."));
  }, [activity.id, signedIn]);

  async function reserve() {
    if (!isReserved && available <= 0) return;
    if (!signedIn) return;
    setPending(true);
    const response = await fetch("/api/reservations", {
      method: isReserved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: activity.id }),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setNotice(result.error ?? "Nepavyko atnaujinti rezervacijos.");
      return;
    }
    setDatabaseReserved(!isReserved);
    setNotice(isReserved ? "Rezervacija atšaukta." : "Vieta rezervuota.");
    router.refresh();
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
                ? "Tavo vieta pažymėta"
                : available > 0
                  ? "Prisijunk prie nuotykio"
                  : "Visos vietos užimtos"}
            </h2>
            <p>Demonstracija: pakeitimai galioja iki puslapio perkrovimo.</p>
          </div>
          {isReserved ? (
            <button
              type="button"
              className="button button-outline"
              onClick={reserve}
              disabled={pending}
            >
              Atšaukti rezervaciją
            </button>
          ) : available === 0 ? (
            <button type="button" disabled>
              Pilna
            </button>
          ) : signedIn ? (
            <button type="button" onClick={reserve} disabled={pending}>
              Registruoti vietą <Icon name="arrow" />
            </button>
          ) : (
            <Link className="button" href="/login">
              Registruoti vietą <Icon name="arrow" />
            </Link>
          )}
        </div>
        {!signedIn && available > 0 && (
          <p className="demo-note">
            Norėdamas išbandyti rezervavimą, prisijunk prie paskyros.
          </p>
        )}
        <p role="status" className="reservation-notice">
          {notice}
        </p>
      </div>
    </article>
  );
}
