import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request so Server Components see a valid token.
 * `withHeaders` adds request headers for the page (the CSP nonce) on top of the possibly-updated cookies.
 */
export async function updateSupabaseSession(request: NextRequest, withHeaders: (h: Headers) => Headers) {
  const next = () => NextResponse.next({ request: { headers: withHeaders(new Headers(request.headers)) } });
  let response = next();
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Do not run code between createServerClient and getClaims(): it validates the JWT and refreshes an
  // expiring session (writing the new cookies above), so expired sessions recover or sign out cleanly.
  await supabase.auth.getClaims();
  return response;
}
