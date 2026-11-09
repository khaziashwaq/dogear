import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Server-only, and used for exactly two things the API roles
 * must not be able to do: writing the shared book catalogue (from Open Library data the server
 * fetched itself) and deleting an account (auth user + their storage). Never pass it to a store
 * method that acts for the viewer.
 */
let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!env.supabaseUrl || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY isn't set, so new books can't be added to the catalogue.");
  }
  admin ??= createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
