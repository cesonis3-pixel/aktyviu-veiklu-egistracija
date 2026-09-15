import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Neteisingas veiklos ID." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const location = typeof body?.location === "string" ? body.location.trim() : "";
    const organizerName = typeof body?.organizer_name === "string" ? body.organizer_name.trim() : "";
    const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
    const capacity = Number(body?.capacity);

    if (!title || !location || !startsAt || !Number.isInteger(capacity) || capacity < 1 || !organizerName) {
      return NextResponse.json({ error: "Užpildykite pavadinimą, vietą, datą, laiką, organizatoriaus pavadinimą ir teigiamą vietų skaičių." }, { status: 400 });
    }

    const startsAtDate = new Date(startsAt);
    if (Number.isNaN(startsAtDate.getTime()) || startsAtDate <= new Date()) {
      return NextResponse.json({ error: "Veiklos data ir laikas turi būti ateityje." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });

    const { data: activity, error: activityError } = await supabase
      .from("activities")
      .select("id, creator_id, status")
      .eq("id", id)
      .maybeSingle();

    if (activityError) throw activityError;
    if (!activity) return NextResponse.json({ error: "Veikla nerasta." }, { status: 404 });
    if (activity.creator_id !== user.id) {
      return NextResponse.json({ error: "Neturite teisės redaguoti šios veiklos." }, { status: 403 });
    }
    if (activity.status === "cancelled") {
      return NextResponse.json({ error: "Atšaukta veikla negali būti redaguojama." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("activities")
      .update({
        title,
        description: description || null,
        location,
        starts_at: startsAtDate.toISOString(),
        capacity,
        organizer_name: organizerName,
      })
      .eq("id", id)
      .eq("creator_id", user.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Veikla nerasta." }, { status: 404 });
    }

    return NextResponse.json({ success: true, id }, { status: 200 });
  } catch (error) {
    console.error("[activities] edit activity failed", error);
    return NextResponse.json({ error: "Nepavyko atnaujinti veiklos. Bandykite dar kartą." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Neteisingas veiklos ID." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    // RPC pakartoja savininko patikrą po užrakto, naudodama auth.uid().
    const { data: activity, error: readError } = await supabase.from("activities")
      .select("creator_id").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!activity) return NextResponse.json({ error: "Veikla nerasta." }, { status: 404 });
    if (activity.creator_id !== user.id) {
      return NextResponse.json({ error: "Neturite teisės ištrinti šios veiklos." }, { status: 403 });
    }
    const { data, error } = await supabase.rpc("delete_activity", { p_activity_id: id });
    if (error) {
      const errors: Record<string, [number, string]> = {
        P0001: [401, "Prisijunkite prie paskyros."],
        P0002: [404, "Veikla nerasta."],
        P0008: [403, "Neturite teisės ištrinti šios veiklos."],
        P0013: [409, "Šios veiklos ištrinti negalima, nes yra rezervacijų. Naudokite veiklos atšaukimą."],
      };
      const [status, message] = errors[error.code] ?? [500, "Nepavyko ištrinti veiklos. Bandykite dar kartą."];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Nepavyko ištrinti veiklos. Bandykite dar kartą." }, { status: 500 });
  }
}
