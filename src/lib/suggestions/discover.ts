// Candidate discovery: turn a taste profile into a bounded set of lookups, run them in parallel,
// and survive any of them failing. Sources are injected so this is testable without the network.
import { discoverySeeds, type Candidate, type TasteProfile } from "./engine.ts";

export interface SuggestionSources {
  /** Widely read works under one subject heading or genre. */
  subject(subject: string): Promise<Candidate[] | null>;
  /** An author's most widely read works. */
  author(name: string): Promise<Candidate[] | null>;
  /** Books loved by Dogear readers who loved the same books. */
  community(): Promise<Candidate[] | null>;
  /** Books in Dogear's own catalogue in one genre. */
  catalogue(genre: string): Promise<Candidate[] | null>;
  /** Subject headings for a shelved book that has none stored yet. */
  workSubjects(olWorkId: string): Promise<string[] | null>;
}

/** At most this many external lookups per refresh (each is cached for a day). */
export const LIMITS = { subjects: 4, authors: 3, catalogueGenres: 3 } as const;

export interface Discovery {
  candidates: Candidate[];
  /** Lookups made, and how many failed (unreachable, timed out, threw). */
  attempted: number;
  failed: number;
}

export async function discoverCandidates(profile: TasteProfile, sources: SuggestionSources): Promise<Discovery> {
  const seeds = discoverySeeds(profile, { subjects: LIMITS.subjects, authors: LIMITS.authors });
  // Specific headings first; genres fill in when a library has few headings yet.
  const subjects = [...seeds.subjects];
  for (const g of seeds.genres) if (subjects.length < LIMITS.subjects && !subjects.includes(g)) subjects.push(g);

  const lookups: (() => Promise<Candidate[] | null>)[] = [
    ...subjects.map((s) => () => sources.subject(s)),
    ...seeds.authors.map((a) => () => sources.author(a)),
    () => sources.community(),
    ...seeds.genres.slice(0, LIMITS.catalogueGenres).map((g) => () => sources.catalogue(g)),
  ];

  let failed = 0;
  const results = await Promise.all(
    lookups.map(async (run) => {
      try {
        const r = await run();
        if (r == null) failed += 1;
        return r ?? [];
      } catch {
        failed += 1;
        return [];
      }
    }),
  );
  return { candidates: results.flat(), attempted: lookups.length, failed };
}
