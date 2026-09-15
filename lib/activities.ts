import type { Activity } from "./demo-activities";
import { createClient } from "./supabase/server";

type ActivityRow = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  starts_at: string;
  capacity: number;
  status: "active" | "cancelled";
  available: number;
};

export function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    category: "Aktyvus laisvalaikis",
    date: row.starts_at,
    dateLabel: new Intl.DateTimeFormat("lt-LT", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Vilnius",
    }).format(new Date(row.starts_at)),
    location: row.location,
    organizer: "Organizatorius",
    capacity: row.capacity,
    available: row.available,
    status: row.status,
    image: "/images/winter-adventure.jpg",
    imageAlt: "Žiemos aktyvios veiklos dalyviai",
    description: row.description ?? "",
  };
}

export async function getActivities() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_activities");
  if (error) throw error;
  return (data as ActivityRow[]).map(toActivity);
}
