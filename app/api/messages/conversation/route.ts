import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some(key => !["message_id", "message"].includes(key)) ||
    typeof body.message_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.message_id) ||
    typeof body.message !== "string" || !body.message.trim() || Array.from(body.message).length > 2000) {
    return NextResponse.json({ error: "Įveskite žinutę (iki 2000 simbolių)." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    const { data: original, error: lookupError } = await supabase.from("activity_messages")
      .select("id, activity_id, sender_id, recipient_id, subject").eq("id", body.message_id)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).maybeSingle();
    if (lookupError) throw lookupError;
    if (!original || (original.sender_id !== user.id && original.recipient_id !== user.id)) {
      return NextResponse.json({ error: "Pokalbis nerastas arba neturite teisės jame rašyti." }, { status: 403 });
    }
    let result;
    if (original.recipient_id === user.id) {
      result = await supabase.rpc("reply_activity_message", { p_message_id: original.id, p_message: body.message });
    } else {
      // Before the first reply, the participant can keep writing to the creator.
      // The RPC derives the recipient again inside the database.
      const { data: activity, error } = await supabase.from("activities").select("creator_id").eq("id", original.activity_id).maybeSingle();
      if (error) throw error;
      if (!activity || activity.creator_id !== original.recipient_id || activity.creator_id === user.id) {
        return NextResponse.json({ error: "Šiame pokalbyje siųsti žinutės negalima. Atnaujinkite pokalbį." }, { status: 403 });
      }
      result = await supabase.rpc("send_activity_message", {
        p_activity_id: original.activity_id, p_subject: original.subject, p_message: body.message,
      });
    }
    if (result.error) {
      const errors: Record<string, [number, string]> = {
        P0001: [401, "Prisijunkite prie paskyros."], P0002: [404, "Veikla nerasta."],
        P0024: [403, "Neturite teisės rašyti šiame pokalbyje."], P0020: [403, "Negalite rašyti sau."],
        P0021: [400, "Įveskite žinutę (iki 2000 simbolių)."],
      };
      const [status, error] = errors[result.error.code] ?? [500, "Nepavyko išsiųsti žinutės. Bandykite dar kartą."];
      return NextResponse.json({ error }, { status });
    }
    return NextResponse.json(result.data);
  } catch { return NextResponse.json({ error: "Nepavyko išsiųsti žinutės. Bandykite dar kartą." }, { status: 500 }); }
}
