import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActivities } from "@/lib/activities";
import { MyActivities } from "@/components/my-activities";
import { Icon } from "@/components/icon";

export default async function MyActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  const { updated } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let activities: Awaited<ReturnType<typeof getActivities>> = [];
  let error = false;
  if (user) {
    try { activities = (await getActivities()).filter(activity => activity.creator_id === user.id); }
    catch { error = true; }
  }

  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <div className="section-heading">
          <div>
            <h1>Mano veiklos</h1>
            <p>Kurk savo nuotykius ir suburk bendraminčius.</p>
          </div>
          {user && (
            <Link className="button" href="/my-activities/new">
              Sukurti veiklą
            </Link>
          )}
        </div>
      </div>
      {!user ? (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Prisijunk prie savo paskyros</h2>
          <p>Prisijungęs galėsi pasiekti savo veiklų puslapį.</p>
          <Link className="button" href="/login">
            Prisijungti
          </Link>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Icon name="plus" />
          <h2>Nepavyko gauti veiklų</h2>
          <p>Patikrink Supabase ryšį ir bandyk dar kartą.</p>
        </div>
      ) : (
        <MyActivities activities={activities} initialNotice={updated === "1" ? "Veikla atnaujinta" : ""} />
      )}
    </main>
  );
}
