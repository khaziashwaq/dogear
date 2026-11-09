import { configProblem } from "@/lib/env";

/** Refuse to serve a production build that isn't fully configured (fail closed, never fall back to sample data). */
export function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const problem = configProblem();
  if (problem) throw new Error(problem);
}
