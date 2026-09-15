import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: messages, error } = await supabase
    .from("activity_messages")
    .select("id, subject, message, created_at, read_at, sender_id, recipient_id, activities(title)")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main id="main-content" className="container page-section">
        <h1>Žinutės</h1>
        <p>Nepavyko įkėlimi žinučių. Bandykite dar kartą.</p>
      </main>
    );
  }

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
      {!messages || messages.length === 0 ? (
        <div className="empty-state">
          <h2>Žinučių nėra</h2>
          <p>Kol kas jums neskirta jokių žinučių.</p>
        </div>
      ) : (
        <div className="activity-grid">
          {messages.map((message) => {
            const activityTitle = (() => {
              if (Array.isArray(message.activities)) {
                return message.activities[0]?.title ?? "Nežinoma";
              }

              if (message.activities && typeof message.activities === "object" && "title" in message.activities) {
                return (message.activities as { title?: string | null }).title ?? "Nežinoma";
              }

              return "Nežinoma";
            })();
            return (
              <article key={message.id} className="activity-card">
                <div className="activity-body">
                  <h3>{message.subject}</h3>
                  <p><strong>Veikla:</strong> {activityTitle ?? "Nežinoma"}</p>
                  <p><strong>Siuntėjas:</strong> {message.sender_id === user.id ? "Jūs" : message.sender_id}</p>
                  <p><strong>Gavėjas:</strong> {message.recipient_id === user.id ? "Jūs" : message.recipient_id}</p>
                  <p>{message.message}</p>
                  <p><small>{new Date(message.created_at).toLocaleString("lt-LT")}</small></p>
                  {message.recipient_id === user.id && !message.read_at ? (
                    <Link href="#" className="button button-outline">Pažymėti kaip perskaitytą</Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
