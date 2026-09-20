"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
  const inFlight = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  async function cancel(activityId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(activityId);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error ?? "Nepavyko atšaukti rezervacijos."); return; }
      setNotice("Rezervacija atšaukta.");
      router.refresh();
    } catch { setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą."); }
    finally { inFlight.current = false; setPending(null); }
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
      {notice && <p role="status" className="reservation-notice">{notice}</p>}
      {error ? (
        <div className="empty-state">
          <Icon name="ticket" />
          <h2>Nepavyko gauti rezervacijų</h2>
          <p>{error}</p>
        </div>
      ) : items.length ? (
        <div className="activity-grid">
          {items.map(({ activity, reservation }) => (
            <div key={activity.id}>
              <ActivityCard activity={activity} signedIn />
              {activity.status === "cancelled" ? (
                <p className="activity-note">
                  Organizatorius atšaukė veiklą. Tavo rezervacijos įrašas išsaugotas.
                  {reservation.status === "cancelled" ? " Rezervacijos būsena: atšaukta." : " Rezervacijos būsena: aktyvi; veikla neįvyks."}
                </p>
              ) : <button type="button" disabled={Boolean(pending)} onClick={() => cancel(activity.id)}>
                {pending === activity.id ? "Atšaukiama..." : "Atšaukti rezervaciją"}
              </button>}
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
