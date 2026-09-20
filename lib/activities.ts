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
  image: "/images/winter-forest.jpg",
  imageAlt: "Žiemos aktyvaus laisvalaikio veikla",
};

// Vienintelė vieta, kur veiklos pavadinimas susiejamas su esamu paveikslėliu.
export function getActivityImage(title: string): ActivityImage {
  const value = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/keturra|keturic|\batv\b/.test(value)) return {
    category: "Keturračiai", image: "/images/winter-atv.png", imageAlt: "Keturračiai su vairuotojais snieguotame miško take",
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
  if (/slidin|silidin|\bski(?:ing)?\b/.test(value)) return {
    category: "Slidinėjimas", image: "/images/winter-adventure.jpg", imageAlt: "Slidininkai su slidėmis snieguotame kalnų šlaite",
  };
  if (/zyg|zygi|hiking|hike|pasivaiksc/.test(value)) return {
    category: "Žiemos žygiai", image: "/images/ski-tour.jpg", imageAlt: "Žygeiviai su sniegbačiais eina snieguotu miško taku",
  };
  if (/treniruot|fitness|sport/.test(value)) return {
    category: "Lauko treniruotės", image: "/images/winter-fitness.png", imageAlt: "Dalyviai atlieka mankštos pratimus snieguotame parke",
  };
  return fallbackImage;
}

export function toActivity(row: ActivityRow): Activity {
  const date = new Date(row.starts_at);
  const organizerName = row.organizer_name?.trim() || "Veiklos organizatorius";
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
    canReactivate: row.status === "cancelled" && date.getTime() > Date.now(),
  };
}

export async function getActivities() {
  const supabase = await createClient();
  const data: ActivityRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data: page, error } = await supabase.rpc("get_public_activities")
      .order("starts_at").order("id").range(offset, offset + 499);
    if (error) throw error;
    data.push(...(page ?? []));
    if (!page || page.length < 500) break;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const reserved = new Set<string>();
  if (user) {
    for (let offset = 0; ; offset += 500) {
      const { data: page, error } = await supabase.from("reservations").select("activity_id")
        .eq("user_id", user.id).eq("status", "active").order("id").range(offset, offset + 499);
      if (error) throw error;
      for (const row of page ?? []) reserved.add(row.activity_id);
      if (!page || page.length < 500) break;
    }
  }
  return data.map(row => ({
    ...toActivity(row),
    isReserved: reserved.has(row.id),
    isOwner: Boolean(user && row.creator_id === user.id),
  }));
}

export async function getActivity(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const supabase = await createClient();
  // Filter inside the RPC, before PostgREST's row limit; status is never a filter.
  const detail = await supabase.rpc("get_public_activity", { p_activity_id: id }).maybeSingle();
  if (!detail.error) return detail.data ? toActivity(detail.data as ActivityRow) : null;

  // Keep deployments usable while the additive RPC migration is waiting to be
  // applied. Other database errors must remain visible instead of becoming 404s.
  if (detail.error.code !== "PGRST202" && detail.error.code !== "42883") throw detail.error;
  const fallback = await supabase.rpc("get_public_activities").eq("id", id).maybeSingle();
  if (fallback.error) throw fallback.error;
  return fallback.data ? toActivity(fallback.data as ActivityRow) : null;
}
