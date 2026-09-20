import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseActivityTime } from "@/lib/activity-time";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
  const capacity = Number(body?.capacity);
  const organizerName = typeof body?.organizer_name === "string" ? body.organizer_name.trim() : "";

  if (!title || !location || !startsAt || !Number.isInteger(capacity) || capacity < 1 || !organizerName) {
    return NextResponse.json(
      { error: "Užpildykite pavadinimą, vietą, datą, laiką, organizatoriaus pavadinimą ir teigiamą vietų skaičių." },
      { status: 400 },
    );
  }
  const startsAtDate = parseActivityTime(startsAt);
  if (Number.isNaN(startsAtDate.getTime()) || startsAtDate <= new Date()) {
    return NextResponse.json(
      { error: "Veiklos data ir laikas turi būti ateityje." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("create_activity", {
    p_title: title,
    p_description: description || null,
    p_location: location,
    p_starts_at: startsAtDate.toISOString(),
    p_capacity: capacity,
    p_organizer_name: organizerName,
  });
  if (error) {
    console.error("[activities] create_activity RPC failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
    });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details || undefined,
        hint: error.hint || undefined,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
