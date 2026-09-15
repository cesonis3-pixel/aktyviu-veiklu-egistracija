import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reservationError } from "@/lib/reservation-errors";

export async function GET(request: Request) {
  const activityId = new URL(request.url).searchParams.get("activityId");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ reserved: false });

  let query = supabase
    .from("reservations")
    .select("activity_id")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (activityId) query = query.eq("activity_id", activityId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    reserved: Boolean(activityId && data.some((row) => row.activity_id === activityId)),
    reservations: data,
  });
}

export async function POST(request: Request) {
  return changeReservation(request, "reserve_activity");
}

export async function DELETE(request: Request) {
  return changeReservation(request, "cancel_reservation");
}

async function changeReservation(request: Request, action: "reserve_activity" | "cancel_reservation") {
  const body = await request.json().catch(() => null);
  if (typeof body?.activityId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.activityId)) {
    return NextResponse.json({ error: "Neteisingas veiklos ID." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    const { data, error } = await supabase.rpc(action, { p_activity_id: body.activityId });
    if (error) {
      const mapped = reservationError(error.code);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json(data);
  } catch {
    const mapped = reservationError();
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
