// Central place for runtime configuration. Only NEXT_PUBLIC_* values are ever read
// on the client; there is intentionally no service-role key anywhere in this app.

// Dashboards and .env files sometimes keep surrounding quotes or spaces; strip them so `"true"` still counts.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

export const env = {
  siteUrl: clean(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000",
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  googleAuthEnabled: clean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toLowerCase() === "true",
};

/** True when Supabase credentials are configured; otherwise dogear. runs in demo mode. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
