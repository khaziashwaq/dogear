// Central place for runtime configuration. Only NEXT_PUBLIC_* values are read on the client.
// The service-role key is read only in src/lib/supabase/admin.ts (server-only).

// Dashboards and .env files sometimes keep surrounding quotes or spaces; strip them so `"true"` still counts.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

export const env = {
  siteUrl: clean(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000",
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  googleAuthEnabled: clean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toLowerCase() === "true",
};

/** True when Supabase credentials are configured. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/**
 * Local sample-data mode: a development server with no Supabase configured. Never in a
 * production build, so a deployment with missing settings fails loudly instead of quietly
 * serving (and trying to write) sample data.
 */
export const isDemoMode = !isSupabaseConfigured && process.env.NODE_ENV !== "production";

/** What's missing for this server to run, or null. Checked at startup (instrumentation.ts) and per request. */
export function configProblem(): string | null {
  if (isDemoMode) return null;
  const missing = [
    !env.supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !env.supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NODE_ENV === "production" && !clean(process.env.SUPABASE_SERVICE_ROLE_KEY) && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  return missing.length ? `dogear. can't start: set ${missing.join(", ")} (see .env.example).` : null;
}
