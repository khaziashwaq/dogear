import { googleSignInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/** The only way in: Google. A first sign-in creates the account and goes on to profile setup. */
export function GoogleSignIn({ next, enabled }: { next?: string; enabled: boolean }) {
  return (
    <form action={googleSignInAction}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Button type="submit" variant="paper" size="lg" className="w-full" disabled={!enabled} aria-describedby={enabled ? undefined : "google-off"}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
        Continue with Google
      </Button>
      {!enabled && (
        <p id="google-off" className="mt-2 text-center text-xs text-ink-faint">Google sign-in isn&rsquo;t set up on this server yet.</p>
      )}
    </form>
  );
}
