import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/proxy-session";

// Session plumbing, the Content-Security-Policy, and an optimistic redirect for signed-out
// visitors on private pages. Real authorisation still happens in RLS and in server components/actions.
const PRIVATE = ["/home", "/activity", "/import", "/notifications", "/bookmarks", "/diary", "/settings", "/shelf", "/onboarding", "/review/new", "/quotes/new", "/lists/new"];

function hasSession(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name === "dogear_demo_session" || (name.startsWith("sb-") && name.includes("-auth-token")));
}

const dev = process.env.NODE_ENV === "development";
const supabaseOrigin = env.supabaseUrl ? new URL(env.supabaseUrl).origin : "";

/**
 * A strict, nonce-based policy (Next adds the nonce to its own scripts). Images: our own, Open Library
 * covers (which redirect to archive.org), Supabase storage and Google profile photos. Forms may post to
 * Supabase and Google because "Continue with Google" is a server-action redirect into their sign-in.
 */
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (positions, colours, 3D transforms) are part of the design.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://covers.openlibrary.org https://archive.org https://*.archive.org https://lh3.googleusercontent.com ${supabaseOrigin}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}${dev ? " ws: wss:" : ""}`.trim(),
    "media-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${supabaseOrigin} https://accounts.google.com`.trim(),
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(p + "/")) && !hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const withHeaders = (h: Headers) => {
    h.set("x-nonce", nonce);
    h.set("Content-Security-Policy", csp);
    return h;
  };
  const response = isSupabaseConfigured
    ? await updateSupabaseSession(request, withHeaders)
    : NextResponse.next({ request: { headers: withHeaders(new Headers(request.headers)) } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon|api/demo-media|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
