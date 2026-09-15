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

const presentation: Partial<Record<string, Partial<Pick<Activity, "category" | "organizer" | "image" | "imageAlt">>>> = {
  "Slidinėjimo treniruotė": {
    "category": "Slidinėjimas",
    "organizer": "Jurgita",
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
  "Žiemos aktyvi veikla": {
    "category": "Aktyvus laisvalaikis",
    "organizer": "Povilas",
    "image": "/images/winter-adventure.jpg",
    "imageAlt": "Žiemos nuotykių dalyviai keliauja per snieguotą mišką"
  }
};

// Pavadinimas parenka tik iliustraciją ir kategoriją; DB tekstai ir UUID išlieka.
function thematicPresentation(title: string) {
  const value = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/keturrat|keturrac|keturic|\batv\b/.test(value)) return {
    category: "Keturračiai", image: "/images/winter-atv.png", imageAlt: "Keturračiai su vairuotojais snieguotame miško take",
  };
  if (/snieglent/.test(value)) return {
    category: "Snieglentės", image: "/images/winter-snowboard.png", imageAlt: "Snieglentininkas leidžiasi snieguotu šlaitu",
  };
  if (/rogut|rogem|rogiu/.test(value)) return {
    category: "Rogutės", image: "/images/winter-sledding.png", imageAlt: "Dalyviai leidžiasi rogutėmis nuo snieguoto kalnelio",
  };
  if (/ciuozi|paciuz/.test(value)) return {
    category: "Čiuožimas", image: "/images/winter-skating.png", imageAlt: "Dalyviai su pačiūžomis žiemos lauko čiuožykloje",
  };
  if (/slidin|slidem|slidzi/.test(value)) return {
    category: "Slidinėjimas", image: "/images/ski-tour.jpg", imageAlt: "Slidininkų grupė snieguotame miške",
  };
  if (/treniruot|mankst|fitnes/.test(value)) return {
    category: "Lauko treniruotės", image: "/images/winter-fitness.png", imageAlt: "Dalyviai atlieka mankštos pratimus snieguotame parke",
  };
  if (/zyg|vaiksc|pesci/.test(value)) return {
    category: "Žygiai", image: "/images/winter-adventure.jpg", imageAlt: "Žygio dalyviai keliauja snieguotu mišku",
  };
  return {};
}

export function toActivity(row: ActivityRow): Activity {
  const date = new Date(row.starts_at);
  const organizerName = row.organizer_name?.trim() || "Organizatorius";
  return {
    id: row.id,
    creator_id: row.creator_id,
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
    organizer: organizerName,
    organizer_name: organizerName,
    capacity: row.capacity,
    available: row.available,
    status: row.status,
    image: "/images/winter-mountains.jpg",
    imageAlt: "Snieguotas žiemos kraštovaizdis",
    description: row.description ?? "",
    ...thematicPresentation(row.title),
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
