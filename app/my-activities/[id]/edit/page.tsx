import { redirect } from "next/navigation";
import { ActivityForm } from "@/components/activity-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: activity, error } = await supabase
    .from("activities")
    .select("id, title, description, location, starts_at, capacity, organizer_name, creator_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !activity || activity.creator_id !== user.id) {
    redirect("/my-activities");
  }

  return (
    <main id="main-content" className="container page-section">
      <ActivityForm
        mode="edit"
        activity={{
          id: activity.id,
          title: activity.title,
          description: activity.description ?? "",
          location: activity.location,
          startsAt: new Date(activity.starts_at).toISOString().slice(0, 16),
          capacity: activity.capacity,
          organizer_name: activity.organizer_name ?? "",
        }}
      />
    </main>
  );
}
