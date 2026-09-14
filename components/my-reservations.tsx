"use client";
import Link from "next/link";
import { activities } from "@/lib/demo-activities";
import { ActivityCard } from "./activity-card";
import { useDemoReservations } from "./demo-reservations";
import { Icon } from "./icon";
export function MyReservations() {
  const { signedIn, reserved } = useDemoReservations();
  const mine = activities.filter((activity) => reserved.includes(activity.id));
  if (!signedIn)
    return (
      <div className="empty-state">
        <Icon name="ticket" />
        <h2>Prisijunk ir peržiūrėk savo rezervacijas</h2>
        <p>Tavo pasirinkti nuotykiai – vienoje vietoje.</p>
        <Link href="/login" className="button">
          Prisijungti
        </Link>
      </div>
    );
  return (
    <>
      <p className="demo-note">
        Čia rodomi tik demonstraciniai pasirinkimai. Perkrovus puslapį jie
        išnyksta.
      </p>
      {mine.length ? (
        <div className="activity-grid">
          {mine.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="ticket" />
          <h2>Dar neturi rezervacijų</h2>
          <p>Atrask veiklą kitam savo žiemos nuotykiui.</p>
          <Link href="/activities" className="button">
            Peržiūrėti veiklas
          </Link>
        </div>
      )}
    </>
  );
}
