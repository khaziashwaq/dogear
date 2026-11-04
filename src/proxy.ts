import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/proxy-session";

// Session plumbing + an optimistic redirect for signed-out visitors on private
// pages. Real authorisation still happens in RLS and in server components/actions.
const PRIVATE = ["/home", "/notifications", "/bookmarks", "/diary", "/settings", "/shelf", "/onboarding", "/review/new", "/quotes/new", "/lists/new"];

function hasSession(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name === "dogear_demo_session" || (name.startsWith("sb-") && name.includes("-auth-token")));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(p + "/")) && !hasSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (!isSupabaseConfigured) return NextResponse.next();
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|api/demo-media|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf)$).*)"],
};
