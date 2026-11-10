"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStore } from "@/lib/auth";

const INVITE_COOKIE = "dogear_invite";
const code = z.string().regex(/^[A-Za-z0-9_-]{12,40}$/);

/** Accept an invite: remember the code through sign-in (a week, this browser only), then join. */
export async function acceptInviteAction(form: FormData) {
  const parsed = code.safeParse(form.get("code"));
  if (!parsed.success) redirect("/login");
  (await cookies()).set(INVITE_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  const store = await getStore();
  redirect(store.viewerId ? "/onboarding" : "/login?next=/onboarding");
}

/** Called when onboarding finishes: claim the invite the reader arrived with, once. */
export async function claimPendingInvite() {
  const jar = await cookies();
  const raw = jar.get(INVITE_COOKIE)?.value;
  if (!raw) return;
  jar.delete(INVITE_COOKIE);
  const parsed = code.safeParse(raw);
  if (!parsed.success) return;
  try {
    await (await getStore()).redeemInvite(parsed.data);
  } catch (e) {
    // An invite that can't be claimed (expired, used up) must never block finishing onboarding.
    console.error("[dogear invite]", e);
  }
}
