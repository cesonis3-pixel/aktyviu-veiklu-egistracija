import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Neteisingas veiklos ID." }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Prisijunkite prie paskyros." }, { status: 401 });
    const { data, error } = await supabase.rpc("reactivate_activity", { p_activity_id: id });
    if (error) {
      const errors: Record<string, [number, string]> = {
        P0001: [401, "Prisijunkite prie paskyros."],
        P0002: [404, "Veikla nerasta."],
        P0008: [403, "Neturite teisės aktyvuoti šios veiklos."],
        P0022: [409, "Aktyvuoti galima tik atšauktą veiklą."],
        P0023: [409, "Negalima aktyvuoti veiklos, kurios data jau praėjo. Pirmiausia pakeiskite datą."],
      };
      const [status, message] = errors[error.code] ?? [500, "Nepavyko aktyvuoti veiklos. Bandykite dar kartą."];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Nepavyko aktyvuoti veiklos. Bandykite dar kartą." }, { status: 500 });
  }
}
