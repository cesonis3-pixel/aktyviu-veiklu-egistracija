import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupConversations, messageTime } from "@/lib/conversations";
import { readMessages, readParticipantNames } from "@/lib/message-data";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  let conversations;
  try { conversations = groupConversations(await readMessages(supabase, user.id), user.id); }
  catch {
    return <main id="main-content" className="container page-section"><h1>Pokalbiai</h1><p role="alert">Nepavyko įkelti žinučių. Bandykite dar kartą.</p></main>;
  }
  const names = await readParticipantNames(supabase, conversations.map(item => item.otherUserId));
  return <main id="main-content" className="container page-section messages-page">
    <div className="page-heading"><h1>Pokalbiai</h1><p>Jūsų susirašinėjimai apie žiemos veiklas.</p></div>
    {!conversations.length ? <div className="empty-state"><h2>Pokalbių dar nėra</h2><p>Pasirinkite veiklą ir parašykite jos organizatoriui.</p><Link href="/activities">Atrasti veiklas</Link></div> :
      <ul className="conversation-list" aria-label="Pokalbiai">
        {conversations.map(conversation => {
          const name = names.get(conversation.otherUserId) ?? "Dalyvis";
          return <li key={`${conversation.activityId}:${conversation.otherUserId}`}>
            <Link className="conversation-link" href={`/messages/${conversation.latest.id}`}>
              <span className="conversation-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
              <span className="conversation-summary"><strong>{name}</strong><span>{conversation.activityTitle}</span>
                <span className="conversation-preview">{conversation.latest.sender_id === user.id ? "Jūs: " : ""}{conversation.latest.message.replace(/\s+/g, " ").slice(0, 140)}</span></span>
              <time dateTime={conversation.latest.created_at}>{messageTime(conversation.latest.created_at)}</time>
            </Link>
          </li>;
        })}
      </ul>}
  </main>;
}
