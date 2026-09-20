"use client";
import Image from "next/image";
import Link from "next/link";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";

export function ActivityCard({ activity, currentUserId, signedIn = false }: { activity: Activity; currentUserId?: string | null; signedIn?: boolean }) {
  const isReserved = activity.isReserved;
  const available = activity.available;
  const cancelled = activity.status === "cancelled";
  const isOwner = Boolean(activity.isOwner || (currentUserId && activity.creator_id === currentUserId));
  const href = `/activities/${activity.id}`;
  return (
    <article className="activity-card">
      <Link
        href={href}
        className="activity-image"
        aria-label={`Peržiūrėti: ${activity.title}`}
      >
        <Image
          src={activity.image}
          alt={activity.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <span className="category-badge">{activity.category}</span>
      </Link>
      <div className="activity-body">
        <h3>
          <Link href={href}>{activity.title}</Link>
        </h3>
        <ul className="activity-meta">
          <li>
            <Icon name="calendar" />
            <time dateTime={activity.date}>{activity.dateLabel}</time>
          </li>
          <li>
            <Icon name="pin" />
            {activity.location}
          </li>
          <li>
            <Icon name="user" />
            <span>Organizatorius: {activity.organizer_name?.trim() || "Organizatorius"}</span>
          </li>
        </ul>
        <div className={`availability ${cancelled || available === 0 ? "is-full" : ""}`}>
          <Icon name="users" />
          <span>
            {cancelled ? "Veikla atšaukta" : isReserved
              ? `Vieta rezervuota · Laisvų vietų: ${available} iš ${activity.capacity}`
              : `Laisvų vietų: ${available} iš ${activity.capacity}`}
          </span>
        </div>
        <div className="card-actions">
          <Link className="button button-outline" href={href}>
            Peržiūrėti
          </Link>
          {!isOwner && <Link className="button button-outline" href={signedIn ? `${href}#message` : `/login?next=${encodeURIComponent(`${href}#message`)}`}>
            {signedIn ? "Parašyti organizatoriui" : "Prisijunkite, kad parašytumėte organizatoriui"}
          </Link>}
          {isOwner ? (
            <span className="activity-note">Tai tavo sukurta veikla</span>
          ) : cancelled ? (
            <button disabled type="button">Veikla atšaukta</button>
          ) : isReserved ? (
            <Link className="button" href={`${href}#reservation`}>
              Mano vieta
            </Link>
          ) : available > 0 ? (
            signedIn ? (
              <Link className="button" href={`${href}#reservation`}>Registruotis</Link>
            ) : (
              <Link className="button" href={`/login?next=${encodeURIComponent(href)}`}>Prisijungti ir rezervuoti</Link>
            )
          ) : (
            <button disabled type="button">
              Pilna
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
