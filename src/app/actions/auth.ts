"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env, isDemoMode, isSupabaseConfigured } from "@/lib/env";

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? env.siteUrl;
}

async function setDemoSession(userId: string) {
  const { DEMO_COOKIE, encodeDemoSession } = await import("@/lib/data/demo/session");
  (await cookies()).set(DEMO_COOKIE, encodeDemoSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function googleSignInAction(form: FormData) {
  if (!isSupabaseConfigured || !env.googleAuthEnabled) redirect("/login?error=google-unavailable");
  const next = safeNext(form.get("next"));
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google-failed");
  redirect(data.url);
}

/** Demo mode only: step into one of the sample readers' shoes. */
export async function demoSignInAction(form: FormData) {
  if (!isDemoMode) redirect("/login");
  const username = String(form.get("username") ?? "margo");
  const { getDemoDB } = await import("@/lib/data/demo/db");
  const profile = getDemoDB().profiles.find((p) => p.username === username);
  if (!profile) redirect("/login");
  await setDemoSession(profile.id);
  redirect(safeNext(form.get("next")));
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const sb = await createSupabaseServerClient();
    await sb.auth.signOut();
  } else {
    const { DEMO_COOKIE } = await import("@/lib/data/demo/session");
    (await cookies()).delete(DEMO_COOKIE);
  }
  redirect("/");
}

export async function resetDemoAction() {
  if (!isDemoMode) return;
  const { resetDemoDB } = await import("@/lib/data/demo/db");
  const { DEMO_COOKIE } = await import("@/lib/data/demo/session");
  resetDemoDB();
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/login?reset=1");
}
