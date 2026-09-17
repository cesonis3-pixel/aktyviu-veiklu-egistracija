import Link from "next/link";
import { Hero } from "@/components/hero";
import { ActivityCard } from "@/components/activity-card";
import { FeatureCard } from "@/components/feature-card";
import { Icon } from "@/components/icon";
import { getActivities } from "@/lib/activities";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const activities = await getActivities();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <main id="main-content">
      <Hero />
      <section className="section container" aria-labelledby="popular-title">
        <div className="section-heading">
          <h2 id="popular-title">Populiarios veiklos</h2>
          <Link className="text-link" href="/activities">
            Visos veiklos <Icon name="arrow" />
          </Link>
        </div>
        <div className="activity-grid">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} currentUserId={user?.id ?? null} />
          ))}
        </div>
        <p className="activity-note">
          Atrask, peržiūrėk ir rezervuok.
        </p>
      </section>
      <section className="features-section" aria-labelledby="features-title">
        <div className="container">
          <h2 id="features-title">Kodėl Baltic Winter?</h2>
          <div className="feature-grid">
            <FeatureCard icon="compass" title="Atrask veiklas">
              Slidinėjimas, žygiai ir naujos patirtys. Rask tai, kas kviečia
              tave į lauką.
            </FeatureCard>
            <FeatureCard icon="ticket" title="Rezervuok vietą">
              Išsirink savo nuotykį ir prisijunk prie bendraminčių.
            </FeatureCard>
            <FeatureCard icon="plus" title="Kurk savo nuotykius">
              Suburk žmones, dalinkis savo pomėgiais ir atrask žiemą kartu.
            </FeatureCard>
          </div>
        </div>
      </section>
    </main>
  );
}
