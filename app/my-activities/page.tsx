import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/lib/activity";
import { ActivityCard } from "@/components/activity-card";
import { Icon } from "@/components/icon";

function toActivity(row: {
  id: string;
  title: string;
  description: string | null;
  location: string;
  starts_at: string;
  capacity: number;
  status: string;
  creator_id: string;
}): Activity {
  const date = new Date(row.starts_at);
  return {
    id: row.id,
    title: row.title,
    category: "Aktyvus laisvalaikis",
    date: row.starts_at,
    dateLabel: new Intl.DateTimeFormat("lt-LT", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Vilnius",
    }).format(date),
    location: row.location,
    organizer: "Tu",
    capacity: row.capacity,
    available: row.capacity,
    image: "/images/winter-adventure.jpg",
    imageAlt: "Žiemos aktyvios veiklos dalyviai",
    description: row.description ?? "",
  };
}

export default async function MyActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = user
    ? await supabase
        .from("activities")
        .select(
          "id, title, description, location, starts_at, capacity, status, creator_id",
        )
        .eq("creator_id", user.id)
        .order("starts_at", { ascending: true })
    : { data: null, error: null };

  if (error) {
    console.error(
      "[my-activities] Supabase activities query failed",
      JSON.stringify({
        table: "activities",
        select: "id, title, description, location, starts_at, capacity, status, creator_id",
        filter: { column: "creator_id", value: user?.id },
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      }),
    );
  }

  const activities = (data ?? []).map(toActivity);

  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <h1>Mano veiklos</h1>
        <p>Kurk savo nuotykius ir suburk bendraminčius.</p>
      </div>
      {!user ? (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Prisijunk prie savo paskyros</h2>
          <p>Prisijungęs galėsi pasiekti savo veiklų puslapį.</p>
          <Link className="button" href="/login">
            Prisijungti
          </Link>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Nepavyko gauti veiklų</h2>
          <p>Patikrink Supabase ryšį ir bandyk dar kartą.</p>
        </div>
      ) : activities.length ? (
        <div className="activity-grid">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Kol kas neturite veiklų</h2>
          <p>Prisijungusios paskyros sukurtos veiklos bus rodomos čia.</p>
          <Link className="button" href="/activities">
            Peržiūrėti veiklas
          </Link>
        </div>
      )}
    </main>
  );
}
