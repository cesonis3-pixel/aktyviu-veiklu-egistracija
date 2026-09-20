"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icon";
import type { Activity } from "@/lib/activity";
import { ActivityCard } from "./activity-card";
import { ReactivateActivity } from "./reactivate-activity";

export function MyActivities({ activities, initialNotice = "" }: { activities: Activity[]; initialNotice?: string }) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState(initialNotice);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const inFlight = useRef(false);

  async function remove(activityId: string) {
    if (inFlight.current || pendingId) return;
    inFlight.current = true;
    setPendingId(activityId);
    setNotice("");
    try {
      const response = await fetch(`/api/activities/${activityId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko ištrinti veiklos.");
        return;
      }
      setDeletedIds(current => [...current, activityId]);
      setDeletingId(null);
      setNotice("Veikla ištrinta.");
      router.refresh();
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPendingId(null);
    }
  }

  async function cancel(activityId: string) {
    if (inFlight.current || pendingId) return;
    inFlight.current = true;
    setPendingId(activityId);
    setNotice("");
    try {
      const response = await fetch(`/api/activities/${activityId}/cancel`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko atšaukti veiklos.");
        return;
      }
      setNotice("Veikla sėkmingai atšaukta.");
      setConfirmingId(null);
      router.refresh();
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPendingId(null);
    }
  }

  return (
    <>
      {notice && <p role="status" className="reservation-notice">{notice}</p>}
      {!activities.some(activity => !deletedIds.includes(activity.id)) && (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Kol kas neturite veiklų</h2>
          <p>Prisijungusios paskyros sukurtos veiklos bus rodomos čia.</p>
          <Link className="button" href="/my-activities/new">Sukurti veiklą</Link>
        </div>
      )}
      <div className="activity-grid">
        {activities.filter(activity => !deletedIds.includes(activity.id)).map((activity) => (
          <div key={activity.id}>
            <ActivityCard activity={activity} />
            <ReactivateActivity activityId={activity.id} cancelled={activity.status === "cancelled"} isOwner canReactivate={activity.canReactivate} />
            {activity.status === "cancelled" ? (
              <p className="activity-note">Veikla atšaukta</p>
            ) : null}
              <div className="card-actions" style={{ marginTop: "0.5rem" }}>
                <Link className="button button-outline" href={`/my-activities/${activity.id}/edit`}>Redaguoti</Link>
              </div>
            {activity.status === "cancelled" ? null : confirmingId === activity.id ? (
              <div className="activity-confirmation" role="alertdialog" aria-labelledby={`cancel-title-${activity.id}`}>
                <h2 id={`cancel-title-${activity.id}`}>Atšaukti veiklą?</h2>
                <p>
                  Ar tikrai norite atšaukti šią veiklą? Dalyvių rezervacijos išliks,
                  tačiau naujos rezervacijos nebebus priimamos.
                </p>
                <div className="confirmation-actions">
                  <button
                    type="button"
                    onClick={() => cancel(activity.id)}
                    disabled={pendingId === activity.id}
                  >
                    {pendingId === activity.id ? "Atšaukiama..." : "Atšaukti"}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setConfirmingId(null)}
                    disabled={pendingId === activity.id}
                  >
                    Grįžti
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" disabled={Boolean(pendingId)} onClick={() => { setDeletingId(null); setConfirmingId(activity.id); }}>
                Atšaukti veiklą
              </button>
            )}
            {deletingId === activity.id ? (
              <div className="activity-confirmation" role="alertdialog" aria-labelledby={`delete-title-${activity.id}`}>
                <h2 id={`delete-title-${activity.id}`}>Ar tikrai norite ištrinti šią veiklą?</h2>
                <p>Jei yra aktyvių rezervacijų, veiklą galima tik atšaukti. Trynimo atšaukti negalima. Žinutės išliks.</p>
                <div className="confirmation-actions">
                  <button type="button" disabled={Boolean(pendingId)} onClick={() => remove(activity.id)}>{pendingId === activity.id ? "Trinama..." : "Ištrinti"}</button>
                  <button type="button" className="button button-outline" disabled={Boolean(pendingId)} onClick={() => setDeletingId(null)}>Atšaukti</button>
                </div>
              </div>
            ) : (
              <button type="button" className="button button-outline" disabled={Boolean(pendingId)} onClick={() => { setConfirmingId(null); setDeletingId(activity.id); }}>Ištrinti veiklą</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
