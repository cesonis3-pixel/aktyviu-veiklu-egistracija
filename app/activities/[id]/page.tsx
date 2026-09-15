import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityDetail } from "@/components/activity-detail";
import { getActivities } from "@/lib/activities";
import { createClient } from "@/lib/supabase/server";
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activities = await getActivities();
  const activity = activities.find((item) => item.id === id);
  if (!activity) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Savininką skaitome iš lentelės, net jei senesnis sąrašo RPC creator_id negrąžina.
  const { data: owner, error } = user
    ? await supabase.from("activities").select("creator_id").eq("id", activity.id).maybeSingle()
    : { data: null, error: null };
  if (error) throw error;
  const isOwner = !owner || owner.creator_id === user?.id;
  return (
    <main id="main-content" className="container page-section">
      <Link className="back-link" href="/activities">
        ← Grįžti į veiklas
      </Link>
      <ActivityDetail activity={activity} signedIn={Boolean(user)} isOwner={isOwner} />
    </main>
  );
}
