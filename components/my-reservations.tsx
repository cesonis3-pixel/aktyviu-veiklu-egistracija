"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/activity";
import { ActivityCard } from "./activity-card";
import { Icon } from "./icon";
export function MyReservations({
  signedIn,
  error,
  items,
}: {
  signedIn: boolean;
  error?: string;
  items: { reservation: { activity_id: string; status: string }; activity: Activity }[];
}) {
  const router = useRouter();
  async function cancel(activityId: string) {
    await fetch("/api/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId }),
    });
    router.refresh();
  }
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
      {error ? (
        <div className="empty-state">
          <Icon name="ticket" />
          <h2>Nepavyko gauti rezervacijų</h2>
          <p>{error}</p>
        </div>
      ) : items.length ? (
        <div className="activity-grid">
          {items.map(({ activity }) => (
            <div key={activity.id}>
              <ActivityCard activity={activity} />
              <button type="button" onClick={() => cancel(activity.id)}>
                Atšaukti rezervaciją
              </button>
            </div>
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
