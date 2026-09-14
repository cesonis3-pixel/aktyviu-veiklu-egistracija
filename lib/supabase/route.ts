import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";

// Route Handlers can write cookies and cache headers directly to their response.
export function createRouteClient(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, key } = getSupabaseConfig();
  response.headers.set("Cache-Control", "private, no-store");
  return createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
}
