import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { demoSignInAction } from "@/app/actions/auth";
import { GoogleSignIn } from "@/components/auth/auth-form";
import { Avatar } from "@/components/profile/avatar";
import { getViewer } from "@/lib/auth";
import { SEED_USERS } from "@/lib/data/seed/community";
import { env, isDemoMode, isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (await getViewer()) redirect(next ?? "/home");
  const error = sp.error === "google-unavailable" ? "Google sign-in isn't configured on this server." : sp.error ? "That sign-in didn't work. Please try again." : null;

  return (
    <div className="w-full max-w-md">
      <div className="paper dogear relative px-6 py-8 sm:px-9 sm:py-10">
        <div className="tape -top-3 left-10 -rotate-3" aria-hidden />
        <h1 className="text-4xl">Sign in to dogear.</h1>
        <p className="hand mt-2 text-2xl text-ink-soft">new here? the same button makes your shelf</p>
        {sp.reset && <p className="mt-3 text-sm text-sage-deep" role="status">The demo data has been reset.</p>}
        {error && <p className="mt-3 text-sm text-burgundy" role="alert">{error}</p>}
        <div className="mt-7"><GoogleSignIn next={next} enabled={isSupabaseConfigured && env.googleAuthEnabled} /></div>
        <p className="mt-4 text-center text-xs text-ink-faint">First time? You&rsquo;ll pick a username and set up your profile next.</p>
      </div>

      {isDemoMode && (
        <section className="mt-8 border border-dashed border-line-strong px-6 py-5" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-xl">Explore as a sample reader</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Google sign-in needs Supabase. This server is running on local sample data, so step into one of the sample readers&rsquo; shelves instead.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SEED_USERS.slice(0, 5).map((u) => (
              <form key={u.key} action={demoSignInAction}>
                <input type="hidden" name="username" value={u.username} />
                <input type="hidden" name="next" value={next ?? "/home"} />
                <button type="submit" className="flex items-center gap-2 rounded-full border border-line-strong bg-card py-1 pl-1 pr-3 text-sm hover:border-ink">
                  <Avatar profile={{ displayName: u.displayName, username: u.username, avatarUrl: null }} size="xs" />
                  {u.displayName.split(" ")[0]}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
