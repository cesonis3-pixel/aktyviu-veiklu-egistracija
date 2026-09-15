"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";

function reservationMessage(error: string) {
  if (error.includes("Vietų nebeliko") || error.includes("Laisvų vietų")) return "Vietų nebeliko.";
  if (error.includes("jau rezervavote") || error.includes("jau turite rezervaciją")) return "Jūs jau turite rezervaciją šiai veiklai";
  if (error.includes("nebepriima") || error.includes("atšaukta")) return "Ši veikla atšaukta";
  if (error.includes("Prisijung")) return "Norint rezervuoti vietą reikia prisijungti.";
  return error || "Rezervacijos nepavyko pakeisti.";
}

export function ActivityDetail({ activity, signedIn }: { activity: Activity; signedIn: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [reserved, setReserved] = useState(Boolean(activity.isReserved));
  const [available, setAvailable] = useState(activity.available);
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const inFlight = useRef(false);
  const busy = pending || refreshing;

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch(`/api/reservations?activityId=${encodeURIComponent(activity.id)}`)
      .then((response) => response.json())
      .then((data: { reserved?: boolean }) => {
        if (active) setReserved(Boolean(data.reserved));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activity.id, signedIn]);

  async function changeReservation(method: "POST" | "DELETE") {
    if (inFlight.current || busy || !signedIn) return;
    if (method === "POST" && (reserved || available <= 0)) return;
    inFlight.current = true;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const result = (await response.json()) as { available?: number; error?: string };
      if (!response.ok) {
        setNotice(reservationMessage(result.error ?? ""));
        if (response.status === 401) router.push("/login");
        return;
      }
      if (method === "POST") {
        setReserved(true);
        if (typeof result.available === "number") setAvailable(result.available);
        setNotice("Vieta rezervuota");
      } else {
        setReserved(false);
        setAvailable((current) => current + 1);
        setNotice("Rezervacija atšaukta.");
      }
      startTransition(() => router.refresh());
    } catch {
      setNotice("Nepavyko susisiekti su serveriu. Bandykite dar kartą.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <article className="detail-card">
      <div className="detail-image">
        <Image src={activity.image} alt={activity.imageAlt} fill preload sizes="(max-width: 1200px) 100vw, 1160px" />
        <span className="category-badge">{activity.category}</span>
      </div>
      <div className="detail-content">
        <div className="detail-heading">
          <h1>{activity.title}</h1>
          <span className={`place-badge ${available === 0 ? "is-full" : ""}`}>Laisvų vietų: {available}</span>
        </div>
        <ul className="activity-meta detail-meta">
          <li><Icon name="calendar" /><time dateTime={activity.date}>{activity.dateLabel}</time></li>
          <li><Icon name="pin" />{activity.location}</li>
        </ul>
        <div className="detail-columns">
          <section><h2>Apie veiklą</h2><p>{activity.description}</p></section>
          <aside className="organizer">
            <span className="organizer-avatar"><Icon name="user" /></span>
            <div><span className="muted">Organizatorius</span><h2>{activity.organizer}</h2><p>Žiemos nuotykių entuziastas</p></div>
          </aside>
        </div>
        <div className="reservation-panel" id="reservation">
          <div>
            <h2>{reserved ? "Tavo vieta rezervuota" : available > 0 ? "Prisijunk prie nuotykio" : "Visos vietos užimtos"}</h2>
            <p>Rezervacija išsaugoma tavo paskyroje.</p>
          </div>
          {reserved ? (
            <button type="button" className="button button-outline" disabled={busy} onClick={() => changeReservation("DELETE")}>{busy ? "Atšaukiama..." : "Atšaukti rezervaciją"}</button>
          ) : available === 0 ? (
            <button type="button" disabled>Pilna</button>
          ) : signedIn ? (
            <button type="button" disabled={busy} onClick={() => changeReservation("POST")}>{busy ? "Rezervuojama..." : "Registruoti vietą"} <Icon name="arrow" /></button>
          ) : (
            <Link className="button" href="/login">Registruoti vietą <Icon name="arrow" /></Link>
          )}
        </div>
        {!signedIn && available > 0 && <p className="activity-note">Norint rezervuoti vietą reikia prisijungti.</p>}
        <p role="status" className="reservation-notice">{notice}</p>
      </div>
    </article>
  );
}