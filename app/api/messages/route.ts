import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["activity_id", "subject", "message"].includes(key)) ||
      typeof body.activity_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.activity_id) ||
      typeof body.subject !== "string" || !body.subject.trim() || body.subject.trim().length > 120 ||
      typeof body.message !== "string" || !body.message.trim() || body.message.trim().length > 2000) {
    return NextResponse.json({ error: "Neteisingi duomenys. Įveskite temą (iki 120) ir žinutę (iki 2000 simbolių)." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    const { data, error } = await supabase.rpc("send_activity_message", {
      p_activity_id: body.activity_id, p_subject: body.subject.trim(), p_message: body.message.trim(),
    });
    if (error) {
      const errors: Record<string, [number, string]> = {
        P0001: [401, "Prisijunkite prie paskyros."],
        P0002: [404, "Veikla nerasta."],
        P0020: [403, "Negalite siųsti žinutės sau."],
        P0021: [400, "Tema ir žinutė yra privalomi. Tema iki 120, žinutė iki 2000 simbolių."],
      };
      const [status, message] = errors[error.code] ?? [500, "Nepavyko išsiųsti žinutės. Bandykite dar kartą."];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Nepavyko išsiųsti žinutės. Bandykite dar kartą." }, { status: 500 });
  }
}
