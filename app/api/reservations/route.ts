import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const body = (await request.json()) as { activityId?: string };
  if (!body.activityId) {
    return NextResponse.json({ error: "Trūksta veiklos ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_activity", {
    p_activity_id: body.activityId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { activityId?: string };
  if (!body.activityId) {
    return NextResponse.json({ error: "Trūksta veiklos ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_activity_id: body.activityId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
