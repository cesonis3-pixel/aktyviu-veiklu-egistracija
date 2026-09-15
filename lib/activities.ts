import type { Activity } from "./activity";
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

const presentation: Partial<Record<string, Partial<Pick<Activity, "category" | "organizer" | "image" | "imageAlt">>>> = {
  "Slidinėjimo treniruotė": {
    "category": "Slidinėjimas",
    "image": "/images/ski-tour.jpg",
    "imageAlt": "Slidininkų grupė snieguotame miške"
  },
  "Slidinėjimo išvyka": {
    "category": "Slidinėjimas",
    "organizer": "Povilas",
    "image": "/images/ski-tour.jpg",
    "imageAlt": "Slidininkų grupė snieguotame miške"
  },
  "Žygis gamtoje": {
    "category": "Žygiai",
    "organizer": "Jurgita",
    "image": "/images/winter-forest.jpg",
    "imageAlt": "Snieguotas takas tarp žiemos miško medžių"
  },
  "Slidinėjimo treniruotė": {
    "category": "Slidinėjimas",
    "organizer": "Jurgita",
    "image": "/images/ski-tour.jpg",
    "imageAlt": "Slidininkų grupė snieguotame miške"
  },
  "Žiemos aktyvi veikla": {
    "category": "Aktyvus laisvalaikis",
    "organizer": "Povilas",
    "image": "/images/winter-adventure.jpg",
    "imageAlt": "Žiemos nuotykių dalyviai keliauja per snieguotą mišką"
  }
};

export function toActivity(row: ActivityRow): Activity {
  const date = new Date(row.starts_at);
  return {
    id: row.id,
    title: row.title,
    category: "Aktyvus laisvalaikis",
    date: row.starts_at,
    dateLabel: new Intl.DateTimeFormat("lt-LT", {
      dateStyle: "long",
      timeZone: "Europe/Vilnius",
    }).format(date) + " · " + new Intl.DateTimeFormat("lt-LT", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius",
    }).format(date),
    location: row.location,
    organizer: "Organizatorius",
    capacity: row.capacity,
    available: row.available,
    status: row.status,
    image: "/images/winter-adventure.jpg",
    imageAlt: "Žiemos aktyvios veiklos dalyviai",
    description: row.description ?? "",
    ...presentation[row.title],
  };
}

export async function getActivities() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_activities");
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: reservations, error: reservationError } = user
    ? await supabase.from("reservations").select("activity_id")
        .eq("user_id", user.id).eq("status", "active")
    : { data: [], error: null };
  if (reservationError) throw reservationError;
  const reserved = new Set((reservations ?? []).map(row => row.activity_id));
  return (data as ActivityRow[]).map(row => ({
    ...toActivity(row),
    isReserved: reserved.has(row.id),
  }));
}
