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
  const isOwner = Boolean(user && activity.creator_id && activity.creator_id === user.id);
  return (
    <main id="main-content" className="container page-section">
      <Link className="back-link" href="/activities">
        ← Grįžti į veiklas
      </Link>
      <ActivityDetail activity={activity} signedIn={Boolean(user)} isOwner={isOwner} />
    </main>
  );
}
