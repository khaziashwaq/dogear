import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getViewer } from "@/lib/auth";
import { env, isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Join" };

export default async function SignupPage() {
  if (await getViewer()) redirect("/home");
  return (
    <div className="w-full max-w-md">
      <div className="paper dogear relative px-6 py-8 sm:px-9 sm:py-10">
        <div className="tape tape-rose -top-3 right-12 rotate-2" aria-hidden />
        <p className="meta text-burgundy">join dogear.</p>
        <h1 className="mt-1 text-4xl">Start your shelf.</h1>
        <p className="hand mt-2 text-2xl text-ink-soft">leave a little piece of yourself in every book</p>
        <div className="mt-7"><AuthForm mode="signup" googleEnabled={isSupabaseConfigured && env.googleAuthEnabled} /></div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">By joining you agree to be kind in the comments.</p>
    </div>
  );
}
