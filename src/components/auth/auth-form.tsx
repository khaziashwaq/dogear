"use client";

import Link from "next/link";
import { useActionState } from "react";
import { googleSignInAction, signInAction, signUpAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function AuthForm({ mode, next, googleEnabled }: { mode: "login" | "signup"; next?: string; googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(mode === "login" ? signInAction : signUpAction, null);

  if (state?.ok && state.data === "check-email") {
    return (
      <div className="text-center" role="status">
        <p className="hand text-3xl text-burgundy">check your inbox ✉</p>
        <p className="mt-2 text-sm text-ink-soft">We sent a confirmation link. Open it on this device to finish signing up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="next" value={next ?? ""} />
            <Button type="submit" variant="paper" size="lg" className="w-full">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-3"><span className="h-px flex-1 bg-line-strong" /><span className="meta">or</span><span className="h-px flex-1 bg-line-strong" /></div>
        </>
      )}
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="block">
          <span className="meta mb-1.5 block">Email</span>
          <input name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="meta mb-1.5 block">Password</span>
          <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} className="field" placeholder={mode === "signup" ? "At least 8 characters" : ""} />
        </label>
        {state && !state.ok && <p role="alert" className="text-sm text-burgundy">{state.error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-ink-soft">
        {mode === "login" ? (
          <>New here? <Link href="/signup" className="link-underline text-burgundy">Make an account</Link></>
        ) : (
          <>Already a member? <Link href="/login" className="link-underline text-burgundy">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
