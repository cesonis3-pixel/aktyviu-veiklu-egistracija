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

const activityImages = [
  { image: "/images/ski-tour.jpg", imageAlt: "Slidininkų grupė snieguotame miške" },
  { image: "/images/winter-atv.png", imageAlt: "Keturračiai su vairuotojais snieguotame miško take" },
  { image: "/images/winter-fitness.png", imageAlt: "Dalyviai atlieka mankštos pratimus snieguotame parke" },
  { image: "/images/winter-snowboard.png", imageAlt: "Snieglentininkas leidžiasi snieguotu šlaitu" },
  { image: "/images/winter-sledding.png", imageAlt: "Dalyviai leidžiasi rogutėmis nuo snieguoto kalnelio" },
  { image: "/images/winter-skating.png", imageAlt: "Dalyviai su pačiūžomis žiemos lauko čiuožykloje" },
] as const;

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
  if (/zyg|vaiksc|pesci/.test(value)) return { category: "Žygiai" };
  return {};
}

function fallbackImage(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return activityImages[hash % activityImages.length];
}

function hasSpecificImage(title: string) {
  return "image" in thematicPresentation(title);
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
    capacity: row.capacity,
    available: row.available,
    status: row.status,
    description: row.description ?? "",
    ...fallbackImage(row.id),
    ...thematicPresentation(row.title),
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
  const specificallyUsedImages = new Set(
    rows.filter(row => hasSpecificImage(row.title))
      .map(row => thematicPresentation(row.title).image),
  );
  const availableFallbackImages = activityImages.filter(
    image => !specificallyUsedImages.has(image.image),
  );
  const fallbackImages = availableFallbackImages.length ? availableFallbackImages : activityImages;
  // Neatpažintos veiklos gauna skirtingus šešis vaizdus pagal stabilų UUID rikiavimą.
  // Kadangi abu puslapiai ima tą patį visą sąrašą čia, jų priskyrimas sutampa.
  const fallbackById = new Map(
    rows.filter(row => !hasSpecificImage(row.title))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row, index) => [row.id, fallbackImages[index % fallbackImages.length]]),
  );
  return rows.map(row => ({
    ...toActivity({ ...row, creator_id: ownedById.get(row.id) ?? row.creator_id }),
    ...(fallbackById.get(row.id) ?? {}),
    isReserved: reserved.has(row.id),
    isOwner: Boolean(user && ownedById.has(row.id)),
  }));
}
