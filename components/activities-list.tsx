"use client";
import { useState, type FormEvent } from "react";
import { activities } from "@/lib/demo-activities";
import { ActivityCard } from "./activity-card";
import { Icon } from "./icon";

export function ActivitiesList() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter(query.trim().toLocaleLowerCase("lt"));
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
      <p className="demo-note">
        Demonstracinės veiklos · tikros rezervacijos kol kas nevykdomos.
      </p>
      <p className="sr-only" role="status">
        Rasta veiklų: {filtered.length}
      </p>
      {filtered.length ? (
        <div className="activity-grid">
          {filtered.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
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
              setFilter("");
            }}
          >
            Rodyti visas veiklas
          </button>
        </div>
      )}
    </>
  );
}
