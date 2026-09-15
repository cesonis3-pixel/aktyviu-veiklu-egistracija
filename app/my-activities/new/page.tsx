import { redirect } from "next/navigation";
import { ActivityForm } from "@/components/activity-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main id="main-content" className="container page-section">
      <ActivityForm />
    </main>
  );
}
