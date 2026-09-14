import type { Metadata } from "next";
import { ActivitiesList } from "@/components/activities-list";
export const metadata: Metadata = { title: "Visos veiklos" };
export default function ActivitiesPage() {
  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <h1>Visos veiklos</h1>
        <p>Atrask savo kitą žiemos nuotykį.</p>
      </div>
      <ActivitiesList />
    </main>
  );
}
