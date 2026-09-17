import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some(key => key !== "message_ids") ||
    !Array.isArray(body.message_ids) || body.message_ids.length < 1 || body.message_ids.length > 500 ||
    body.message_ids.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Neteisingas žinučių sąrašas." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    const { data, error } = await supabase.rpc("mark_activity_messages_read", { p_message_ids: body.message_ids });
    if (error) {
      return NextResponse.json({ error: "Nepavyko pažymėti žinučių kaip perskaitytų." }, { status: error.code === "P0001" ? 401 : 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Nepavyko pažymėti žinučių kaip perskaitytų." }, { status: 500 });
  }
}
