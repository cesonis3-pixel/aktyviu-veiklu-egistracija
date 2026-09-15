"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReactivateActivity({ activityId, cancelled, isOwner }: {
  activityId: string; cancelled: boolean; isOwner: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const busy = pending || refreshing;

  async function reactivate() {
    if (!isOwner || !cancelled || !confirming || inFlight.current || busy) return;
    inFlight.current = true;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/activities/${activityId}/reactivate`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error ?? "Nepavyko aktyvuoti veiklos.");
        return;
      }
      setNotice("Veikla vėl aktyvi");
      setConfirming(false);
      startTransition(() => router.refresh());
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (!isOwner) return null;
  return (
    <>
      {notice && <p role="status" className="reservation-notice">{notice}</p>}
      {cancelled && (confirming ? (
        <div className="activity-confirmation" role="alertdialog" aria-labelledby={`reactivate-${activityId}`}>
          <h2 id={`reactivate-${activityId}`}>Ar tikrai norite vėl aktyvuoti šią veiklą?</h2>
          <div className="confirmation-actions">
            <button type="button" disabled={busy} onClick={reactivate}>{busy ? "Aktyvuojama..." : "Aktyvuoti"}</button>
            <button type="button" className="button button-outline" disabled={busy} onClick={() => setConfirming(false)}>Atšaukti</button>
          </div>
        </div>
      ) : (
        <button type="button" className="button button-outline" disabled={busy} onClick={() => setConfirming(true)}>Aktyvuoti veiklą</button>
      ))}
    </>
  );
}
