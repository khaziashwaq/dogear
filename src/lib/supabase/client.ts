"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Browser client — only ever uses the public anon key. Used for storage uploads. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
