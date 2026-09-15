import { MyReservations } from "@/components/my-reservations";
import { createClient } from "@/lib/supabase/server";
import { getActivities } from "@/lib/activities";
export default function MyReservationsPage() {
  return <MyReservationsPageContent />;
}

async function MyReservationsPageContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: reservations, error } = user
    ? await supabase
        .from("reservations")
        .select("activity_id, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const activities = user && !error ? await getActivities() : [];
  const items = (reservations ?? [])
    .map((reservation) => ({
      reservation,
      activity: activities.find((activity) => activity.id === reservation.activity_id),
    }))
    .filter((item) => item.activity && (
      item.reservation.status === "active" || item.activity.status === "cancelled"
    ));

  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <h1>Mano rezervacijos</h1>
        <p>Tavo žiemos planai vienoje vietoje.</p>
      </div>
      <MyReservations
        signedIn={Boolean(user)}
        error={error?.message}
        items={items.map(({ reservation, activity }) => ({
          reservation,
          activity: activity!,
        }))}
      />
    </main>
  );
}
