"use client";
import { useState, type FormEvent } from "react";
import type { Activity } from "@/lib/activity";
import { ActivityCard } from "./activity-card";
import { Icon } from "./icon";

export function ActivitiesList({ activities, currentUserId }: { activities: Activity[]; currentUserId?: string | null }) {
  const [query, setQuery] = useState("");
  const filter = query.trim().toLocaleLowerCase("lt");
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }
  const filtered = activities.filter((activity) =>
    `${activity.title} ${activity.category} ${activity.location} ${activity.organizer}`
      .toLocaleLowerCase("lt")
      .includes(filter),
  );
  return (
    <>
      <form className="search-form" onSubmit={search} role="search">
        <label className="search-input">
          <span className="sr-only">
            Ieškoti veiklos pagal pavadinimą, kategoriją, vietą ar organizatorių
          </span>
          <Icon name="search" />
          <input
            type="search"
            placeholder="Ieškoti veiklos..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit">
          <Icon name="filter" />
          Filtruoti
        </button>
      </form>
      <p className="activity-note">
        Atrask, peržiūrėk ir rezervuok.
      </p>
      <p className="sr-only" role="status">
        Rasta veiklų: {filtered.length}
      </p>
      {filtered.length ? (
        <div className="activity-grid">
          {filtered.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} currentUserId={currentUserId} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" />
          <h2>Veiklų nerasta</h2>
          <p>Pabandyk kitą pavadinimą arba vietą.</p>
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setQuery("");
            }}
          >
            Rodyti visas veiklas
          </button>
        </div>
      )}
    </>
  );
}
