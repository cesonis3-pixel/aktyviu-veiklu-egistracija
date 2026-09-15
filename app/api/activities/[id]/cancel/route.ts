import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Neteisingas veiklos ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("cancel_activity", {
    p_activity_id: id,
  });
  if (error) {
    const messages: Record<string, { status: number; message: string }> = {
      P0001: { status: 401, message: "Prisijunkite prie paskyros." },
      P0002: { status: 404, message: "Veikla nerasta." },
      P0008: { status: 403, message: "Neturite teisės atšaukti šios veiklos." },
      P0009: { status: 409, message: "Ši veikla jau atšaukta." },
    };
    const mapped = messages[error.code] ?? {
      status: 500,
      message: "Nepavyko atšaukti veiklos. Bandykite dar kartą.",
    };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json(data);
}
