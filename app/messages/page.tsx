import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: messages, error }, { data: activities }] = await Promise.all([
    supabase
      .from("activity_messages")
      .select("id, activity_id, subject, message, created_at, read_at, sender_id, recipient_id, activities(title)")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_public_activities"),
  ]);

  if (error) {
    return (
      <main id="main-content" className="container page-section">
        <h1>Žinutės</h1>
        <p>Nepavyko įkelti žinučių. Bandykite dar kartą.</p>
      </main>
    );
  }

  const organizerNames = new Map(
    ((activities ?? []) as { id: string; organizer_name: string | null }[])
      .map((activity) => [activity.id, activity.organizer_name?.trim() || "Organizatorius"]),
  );

  return (
    <main id="main-content" className="container page-section">
      <div className="page-heading">
        <div className="section-heading">
          <div>
            <h1>Žinutės</h1>
            <p>Peržiūrėkite gautas ir išsiųstas žinutes apie savo veiklas.</p>
          </div>
        </div>
      </div>
      {(["Gautos", "Išsiųstos"] as const).map(section => {
        const items = (messages ?? []).filter(message => section === "Gautos"
          ? message.recipient_id === user.id : message.sender_id === user.id);
        return <section key={section} aria-label={section} className="section">
        <h2>{section}</h2>
        {items.length === 0 ? (
        <div className="empty-state">
          <h2>Žinučių nėra</h2>
          <p>{section === "Gautos" ? "Kol kas negavote žinučių." : "Kol kas neišsiuntėte žinučių."}</p>
        </div>
      ) : (
        <div className="activity-grid">
          {items.map((message) => {
            const activityTitle = (() => {
              if (Array.isArray(message.activities)) {
                return message.activities[0]?.title ?? "Nežinoma";
              }

              if (message.activities && typeof message.activities === "object" && "title" in message.activities) {
                return (message.activities as { title?: string | null }).title ?? "Nežinoma";
              }

              return "Nežinoma";
            })();
            const recipientName = (() => {
              if (message.recipient_id === user.id) return "Jūs";
              return message.activity_id ? organizerNames.get(message.activity_id) ?? "Organizatorius" : "Organizatorius";
            })();
            return (
              <article key={message.id} className="activity-card">
                <div className="activity-body">
                  <h3>{message.subject}</h3>
                  <p>{message.recipient_id === user.id ? "Gauta žinutė" : "Išsiųsta žinutė"}</p>
                  <p><strong>Veikla:</strong> {message.activity_id ? <Link href={`/activities/${message.activity_id}`}>{activityTitle}</Link> : "Veikla ištrinta"}</p>
                  <p><strong>Siuntėjas:</strong> {message.sender_id === user.id ? "Jūs" : message.sender_id}</p>
                  <p><strong>Gavėjas:</strong> {recipientName}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{message.message}</p>
                  <p><small>{new Date(message.created_at).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius" })}</small></p>
                </div>
              </article>
            );
          })}
        </div>
      )}</section>;
      })}
    </main>
  );
}
