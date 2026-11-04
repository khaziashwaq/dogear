// Central place for runtime configuration. Only NEXT_PUBLIC_* values are ever read
// on the client; there is intentionally no service-role key anywhere in this app.

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  googleAuthEnabled: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
};

/** True when Supabase credentials are configured; otherwise dogear. runs in demo mode. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
