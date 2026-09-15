"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/lib/activity";
import { ActivityCard } from "./activity-card";

export function MyActivities({ activities }: { activities: Activity[] }) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function cancel(activityId: string) {
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
      setPendingId(null);
    }
  }

  return (
    <>
      {notice && <p role="status" className="reservation-notice">{notice}</p>}
      <div className="activity-grid">
        {activities.map((activity) => (
          <div key={activity.id}>
            <ActivityCard activity={activity} />
            {activity.status === "cancelled" ? (
              <p className="activity-note">Veikla atšaukta</p>
            ) : confirmingId === activity.id ? (
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
              <button type="button" onClick={() => setConfirmingId(activity.id)}>
                Atšaukti veiklą
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
