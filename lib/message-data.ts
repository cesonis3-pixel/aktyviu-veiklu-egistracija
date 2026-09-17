import { createClient } from "@/lib/supabase/server";
import type { ConversationMessage } from "@/lib/conversations";

export async function readMessages(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const messages: ConversationMessage[] = [];
  // Paginate so older history is not silently truncated by the API row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("activity_messages")
      .select("id, activity_id, sender_id, recipient_id, subject, message, created_at, read_at, activities(title)")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error("Nepavyko įkelti žinučių.");
    messages.push(...(data ?? []));
    if (!data || data.length < 500) return messages;
  }
}

export async function readParticipantNames(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(ids)];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", uniqueIds.slice(offset, offset + 100));
    for (const profile of data ?? []) names.set(profile.id, profile.display_name?.trim() || "Dalyvis");
  }
  return names;
}
