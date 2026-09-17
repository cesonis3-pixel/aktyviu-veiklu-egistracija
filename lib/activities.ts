import type { Activity } from "./activity";
import { createClient } from "./supabase/server";

type ActivityRow = {
  id: string;
  creator_id?: string;
  title: string;
  description: string | null;
  location: string;
  starts_at: string;
  capacity: number;
  status: "active" | "cancelled";
  available: number;
  organizer_name?: string | null;
};

type ActivityImage = { category: string; image: string; imageAlt: string };

const fallbackImage: ActivityImage = {
  category: "Aktyvus laisvalaikis",
  image: "/images/winter-adventure.jpg",
  imageAlt: "Žiemos aktyvaus laisvalaikio veikla",
};

// Vienintelė vieta, kur veiklos pavadinimas susiejamas su esamu paveikslėliu.
export function getActivityImage(title: string): ActivityImage {
  const value = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/slidin|ski/.test(value)) return {
    category: "Slidinėjimas", image: "/images/ski-tour.jpg", imageAlt: "Slidininkų grupė snieguotame miške",
  };
  if (/keturra|keturic|\batv\b/.test(value)) return {
    category: "Keturračiai", image: "/images/winter-atv.png", imageAlt: "Keturračiai su vairuotojais snieguotame miško take",
  };
  if (/treniruot|fitness|sport/.test(value)) return {
    category: "Lauko treniruotės", image: "/images/winter-fitness.png", imageAlt: "Dalyviai atlieka mankštos pratimus snieguotame parke",
  };
  if (/snieglent|snieglenc|snowboard/.test(value)) return {
    category: "Snieglentės", image: "/images/winter-snowboard.png", imageAlt: "Snieglentininkas leidžiasi snieguotu šlaitu",
  };
  if (/rogut|sled/.test(value)) return {
    category: "Rogutės", image: "/images/winter-sledding.png", imageAlt: "Dalyviai leidžiasi rogutėmis nuo snieguoto kalnelio",
  };
  if (/ciuoz|skating/.test(value)) return {
    category: "Čiuožimas", image: "/images/winter-skating.png", imageAlt: "Dalyviai su pačiūžomis žiemos lauko čiuožykloje",
  };
  return fallbackImage;
}

export function toActivity(row: ActivityRow): Activity {
  const date = new Date(row.starts_at);
  const organizerName = row.organizer_name?.trim() || "Organizatorius";
  const presentation = getActivityImage(row.title);
  return {
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    date: row.starts_at,
    dateLabel: new Intl.DateTimeFormat("lt-LT", {
      dateStyle: "long",
      timeZone: "Europe/Vilnius",
    }).format(date) + " · " + new Intl.DateTimeFormat("lt-LT", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius",
    }).format(date),
    location: row.location,
    capacity: row.capacity,
    available: row.available,
    status: row.status,
    description: row.description ?? "",
    ...presentation,
    organizer: organizerName,
    organizer_name: organizerName,
  };
}

export async function getActivities() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_activities");
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: reservations, error: reservationError }, { data: ownedActivities, error: ownedActivitiesError }] = user
    ? await Promise.all([
      supabase.from("reservations").select("activity_id")
        .eq("user_id", user.id).eq("status", "active"),
      // Savininkas nustatomas pagal auth vartotojo ID ir creator_id, niekada pagal organizer_name.
      supabase.from("activities").select("id, creator_id").eq("creator_id", user.id),
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (reservationError) throw reservationError;
  if (ownedActivitiesError) throw ownedActivitiesError;
  const reserved = new Set((reservations ?? []).map(row => row.activity_id));
  const ownedById = new Map((ownedActivities ?? []).map(row => [row.id, row.creator_id]));
  const rows = data as ActivityRow[];
  return rows.map(row => ({
    ...toActivity({ ...row, creator_id: ownedById.get(row.id) ?? row.creator_id }),
    isReserved: reserved.has(row.id),
    isOwner: Boolean(user && ownedById.has(row.id)),
  }));
}
