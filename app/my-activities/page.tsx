import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
export default async function MyActivitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <h1>Mano veiklos</h1>
        <p>Kurk savo nuotykius ir suburk bendraminčius.</p>
      </div>
      <div className="empty-state">
        <Icon name="plus" />
        <h2>
          {user
            ? "Čia bus tavo sukurtos veiklos"
            : "Prisijunk prie savo paskyros"}
        </h2>
        <p>
          {user
            ? "Veiklų kūrimas bus pasiekiamas kitame etape. Kol kas kviečiame peržiūrėti demonstracines veiklas."
            : "Prisijungęs galėsi pasiekti savo veiklų puslapį."}
        </p>
        <Link className="button" href={user ? "/activities" : "/login"}>
          {user ? "Peržiūrėti veiklas" : "Prisijungti"}
        </Link>
      </div>
    </main>
  );
}
