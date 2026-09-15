"use client";
import Image from "next/image";
import Link from "next/link";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";

export function ActivityCard({ activity }: { activity: Activity }) {
  const isReserved = activity.isReserved;
  const available = activity.available;
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
            <span>Organizatorius: {activity.organizer}</span>
          </li>
        </ul>
        <div className={`availability ${available === 0 ? "is-full" : ""}`}>
          <Icon name="users" />
          <span>
            {isReserved
              ? "Vieta rezervuota"
              : `Laisvų vietų: ${available} iš ${activity.capacity}`}
          </span>
        </div>
        <div className="card-actions">
          <Link className="button button-outline" href={href}>
            Peržiūrėti
          </Link>
          {isReserved ? (
            <Link className="button" href={`${href}#reservation`}>
              Mano vieta
            </Link>
          ) : available > 0 ? (
            <Link className="button" href={`${href}#reservation`}>
              Registruotis
            </Link>
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
