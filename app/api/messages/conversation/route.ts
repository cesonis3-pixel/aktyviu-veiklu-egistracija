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
    const result = await supabase.rpc("send_conversation_message", {
      p_message_id: body.message_id, p_message: body.message,
    });
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
