export type ConversationMessage = {
  id: string; activity_id: string | null; sender_id: string; recipient_id: string;
  subject: string; message: string; created_at: string;
  read_at?: string | null;
  activities?: { title: string } | { title: string }[] | null;
};

export function groupConversations(messages: ConversationMessage[], userId: string) {
  const groups = new Map<string, { otherUserId: string; activityId: string | null; messages: ConversationMessage[] }>();
  for (const message of messages) {
    if (message.sender_id !== userId && message.recipient_id !== userId) continue;
    const otherUserId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    const key = `${message.activity_id ?? "deleted"}:${otherUserId}`;
    const group = groups.get(key) ?? { otherUserId, activityId: message.activity_id, messages: [] };
    group.messages.push(message);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    group.messages.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
    const latest = group.messages[group.messages.length - 1];
    const activity = Array.isArray(latest.activities) ? latest.activities[0] : latest.activities;
    const unreadCount = group.messages.filter(message => message.recipient_id === userId && !message.read_at).length;
    return { ...group, latest, unreadCount, activityTitle: group.activityId ? activity?.title ?? "Veikla" : "Veikla ištrinta" };
  }).sort((a, b) => Date.parse(b.latest.created_at) - Date.parse(a.latest.created_at) || a.latest.id.localeCompare(b.latest.id));
}

export function messageTime(value: string) {
  return new Date(value).toLocaleString("lt-LT", { timeZone: "Europe/Vilnius", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
