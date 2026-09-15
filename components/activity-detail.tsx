"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Activity } from "@/lib/activity";
import { Icon } from "./icon";

function reservationMessage(error: string) {
  if (error.includes("Vietų nebeliko") || error.includes("Laisvų vietų")) return "Vietų nebeliko.";
  if (error.includes("jau rezervavote") || error.includes("jau turite rezervaciją")) return "Jūs jau turite rezervaciją šiai veiklai";
  if (error.includes("nebepriima") || error.includes("atšaukta")) return "Ši veikla atšaukta";
  if (error.includes("Prisijungimas")) return "Norint rezervuoti vietą reikia prisijungti.";
  return error || "Rezervacijos nepavyko sukurti.";
}

export function ActivityDetail({ activity, signedIn }: { activity: Activity; signedIn: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [reserved, setReserved] = useState(Boolean(activity.isReserved));
  const [available, setAvailable] = useState(activity.available);
  const [saving, setSaving] = useState(false);

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

  async function reserve() {
    if (saving || reserved || available <= 0 || !signedIn) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const data = (await response.json()) as { available?: number; error?: string };
      if (!response.ok) {
        setNotice(reservationMessage(data.error ?? ""));
        return;
      }
      setReserved(true);
      if (typeof data.available === "number") setAvailable(data.available);
      setNotice("Vieta rezervuota");
      router.refresh();
    } catch {
      setNotice("Rezervacijos nepavyko sukurti. Bandykite dar kartą.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(reservationMessage(data.error ?? ""));
        return;
      }
      setReserved(false);
      setAvailable((current) => current + 1);
      setNotice("Rezervacija atšaukta.");
      router.refresh();
    } catch {
      setNotice("Rezervacijos atšaukti nepavyko. Bandykite dar kartą.");
    } finally {
      setSaving(false);
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
            <button type="button" className="button button-outline" onClick={cancel} disabled={saving}>{saving ? "Vykdoma..." : "Atšaukti rezervaciją"}</button>
          ) : available === 0 ? (
            <button type="button" disabled>Pilna</button>
          ) : signedIn ? (
            <button type="button" onClick={reserve} disabled={saving}>{saving ? "Rezervuojama..." : "Registruoti vietą"} <Icon name="arrow" /></button>
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