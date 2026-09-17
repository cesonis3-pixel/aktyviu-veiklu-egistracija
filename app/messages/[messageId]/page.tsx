import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupConversations } from "@/lib/conversations";
import { readMessages, readParticipantNames } from "@/lib/message-data";
import { ConversationThread } from "@/components/conversation-thread";

export default async function ConversationPage({ params }: { params: Promise<{ messageId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { messageId } = await params;
  let conversations;
  try { conversations = groupConversations(await readMessages(supabase, user.id), user.id); }
  catch {
    return <main id="main-content" className="container page-section"><Link href="/messages">Visi pokalbiai</Link><p role="alert">Nepavyko įkelti pokalbio. Bandykite dar kartą.</p></main>;
  }
  const conversation = conversations.find(item => item.messages.some(message => message.id === messageId));
  if (!conversation) notFound();
  const names = await readParticipantNames(supabase, [conversation.otherUserId]);
  const anchor = conversation.messages.find(message => message.recipient_id === user.id) ?? conversation.latest;
  return <main id="main-content" className="container page-section messages-page">
    <Link className="conversation-back" href="/messages">← Visi pokalbiai</Link>
    <section className="conversation-panel" aria-label="Pokalbis">
      <header className="conversation-header"><h1>{names.get(conversation.otherUserId) ?? "Dalyvis"}</h1>
        {conversation.activityId ? <Link href={`/activities/${conversation.activityId}`}>{conversation.activityTitle}</Link> : <p>{conversation.activityTitle}</p>}
      </header>
      <ConversationThread messages={conversation.messages} currentUserId={user.id} anchorId={anchor.id} />
    </section>
  </main>;
}
