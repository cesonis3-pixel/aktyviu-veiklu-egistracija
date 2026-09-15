import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
