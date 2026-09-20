import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const returnTo = next?.startsWith("/") && !next.startsWith("//") && !/[\\\u0000-\u0020]/.test(next) ? next : "/";
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  let reason = "confirmation";
  if (code && !request.nextUrl.searchParams.has("error")) {
    try {
      const supabase = createRouteClient(request, response);
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session) return response;
      if (
        error?.code === "flow_state_not_found" ||
        error?.code === "bad_code_verifier" ||
        error?.code === "pkce_code_verifier_not_found"
      ) {
        reason = "confirmation_browser";
      } else if (error?.name === "AuthRetryableFetchError") {
        reason = "confirmation_network";
      }
    } catch {
      reason = "confirmation_network";
    }
  }
  // Keep any cookie cleanup and cache headers produced during the exchange.
  response.headers.set(
    "Location",
    new URL(`/login?error=${reason}`, request.url).href,
  );
  return response;
}
