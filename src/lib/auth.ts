import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { configProblem, isSupabaseConfigured } from "@/lib/env";
import type { DataStore } from "@/lib/data/store";
import type { Profile } from "@/lib/types";

/**
 * Resolve the data store for this request, bound to the signed-in viewer.
 * Memoised per request with React `cache`.
 */
export const getStore = cache(async (): Promise<DataStore> => {
  // Reading cookies first marks every page that uses the store as per-request (never prerendered),
  // which the per-request CSP nonce relies on too.
  const jar = await cookies();
  const problem = configProblem();
  if (problem) throw new Error(problem);
  if (isSupabaseConfigured) {
    const [{ createSupabaseServerClient }, { SupabaseStore }] = await Promise.all([
      import("@/lib/supabase/server"),
      import("@/lib/data/supabase/store"),
    ]);
    const sb = await createSupabaseServerClient();
    // getClaims verifies the session JWT's signature (locally, with the project's signing keys, or via
    // the Auth server for legacy secrets) — the proxy has already refreshed an expiring session.
    const { data, error } = await sb.auth.getClaims();
    const sub = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    return new SupabaseStore(sb, sub);
  }
  const [{ DemoStore }, { DEMO_COOKIE, decodeDemoSession }] = await Promise.all([
    import("@/lib/data/demo/store"),
    import("@/lib/data/demo/session"),
  ]);
  return new DemoStore(decodeDemoSession(jar.get(DEMO_COOKIE)?.value));
});

export const getViewer = cache(async (): Promise<Profile | null> => {
  const store = await getStore();
  if (!store.viewerId) return null;
  return store.getProfileById(store.viewerId);
});

/** For pages that need a fully onboarded reader. */
export async function requireViewer(next?: string): Promise<Profile> {
  const viewer = await getViewer();
  if (!viewer) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (!viewer.onboarded || !viewer.username) redirect("/onboarding");
  return viewer;
}
