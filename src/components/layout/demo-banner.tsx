import { isDemoMode } from "@/lib/env";

/** Honest labelling: when Supabase isn't configured, everything runs on local sample data. */
export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="border-b border-butter-deep/60 bg-butter/70 px-4 py-1.5 text-center text-[0.75rem] text-ink">
      <span className="meta mr-2 text-burgundy">Demo mode</span>
      Sample readers and data stored locally on this server. Add Supabase keys to go live — see README.
    </div>
  );
}
