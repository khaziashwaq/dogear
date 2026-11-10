import "server-only";
import type { DataStore } from "@/lib/data/store";
import type { Page, Suggestion, SuggestionInput, TasteEntry } from "@/lib/types";
import { discoverCandidates, LIMITS, type SuggestionSources } from "./discover";
import { buildProfile, entryWeight, hasSignal, librarySignature, rankCandidates, snapshot } from "./engine";

// The suggestion lifecycle. Shelves change → the library fingerprint changes → the next refresh
// (right after the shelf move, or when the list is opened) rebuilds the list once. Opening the list
// with unchanged shelves costs two small queries and no Open Library calls.

export type RefreshOutcome = "fresh" | "refreshed" | "busy" | "failed" | "empty";

/** A refresh started this recently and not finished (or just failed) isn't repeated yet. */
const BACKOFF_MS = 45_000;
/** Shelved books without stored subject headings fetched per refresh. */
const BACKFILL = 4;

export interface RefreshResult {
  outcome: RefreshOutcome;
  library: TasteEntry[];
  /** Whether the shelves say enough about taste to suggest anything. */
  signal: boolean;
  /** For "busy": how long ago the other refresh started. */
  busyForMs?: number;
}

export async function refreshSuggestions(store: DataStore, sources: SuggestionSources, opts: { now?: number } = {}): Promise<RefreshResult> {
  const me = store.viewerId;
  if (!me) return { outcome: "empty", library: [], signal: false };
  const now = opts.now ?? Date.now();
  const [library, state, profileRow] = await Promise.all([store.tasteLibrary(), store.suggestionState(), store.getProfileById(me)]);
  const signature = librarySignature(library);
  const seeds = { genres: profileRow?.favouriteGenres ?? [], authors: profileRow?.favouriteAuthors ?? [] };

  if (state?.signature === signature) {
    return { outcome: "fresh", library, signal: hasSignal(buildProfile(library, seeds)) };
  }
  if (library.length === 0) {
    // Nothing on the shelves (perhaps everything was removed): clear what's waiting.
    await store.saveSuggestions(signature, []);
    return { outcome: "empty", library, signal: false };
  }
  const attempted = state?.attemptedAt ? Date.parse(state.attemptedAt) : 0;
  const refreshed = state?.refreshedAt ? Date.parse(state.refreshedAt) : 0;
  if (attempted > refreshed && now - attempted < BACKOFF_MS) {
    return { outcome: "busy", library, signal: true, busyForMs: now - attempted };
  }

  // Claim the refresh so a second request (another tab, the post-move refresh) doesn't repeat it.
  await store.saveSuggestions(null, null);

  // Books shelved before subject headings were stored: fetch a few each time, strongest taste first.
  const missing = library
    .filter((e) => e.subjects.length === 0 && e.olWorkId && entryWeight(e) > 0)
    .sort((a, b) => entryWeight(b) - entryWeight(a))
    .slice(0, BACKFILL);
  await Promise.all(
    missing.map(async (e) => {
      try {
        const subjects = await sources.workSubjects(e.olWorkId!);
        if (!subjects?.length) return;
        e.subjects = subjects;
        await store.setBookSubjects(e.bookId, subjects);
      } catch (err) {
        // Enrichment is best-effort: the suggestion still works from genres, moods and authors.
        console.warn("[dogear suggestions] subject backfill", e.bookId, err);
      }
    }),
  );

  const profile = buildProfile(library, seeds);
  if (!hasSignal(profile)) {
    await store.saveSuggestions(signature, []);
    return { outcome: "refreshed", library, signal: false };
  }

  const found = await discoverCandidates(profile, sources);
  if (found.candidates.length === 0 && found.failed > 0) {
    // Couldn't reach anything: keep the current list and try again after the backoff.
    console.warn(`[dogear suggestions] ${found.failed}/${found.attempted} lookups failed; keeping the current list`);
    return { outcome: "failed", library, signal: true };
  }

  const closed = await store.closedSuggestionKeys();
  const ranked = rankCandidates(profile, found.candidates, { exclude: closed, limit: 40 });
  const items: SuggestionInput[] = ranked.map((s) => ({
    workKey: s.workKey,
    bookId: s.candidate.bookId,
    olWorkId: s.candidate.olWorkId,
    book: snapshot(s.candidate),
    score: s.score,
    reasons: s.reasons,
    sourceBookIds: s.sourceBookIds,
  }));
  await store.saveSuggestions(signature, items);
  return { outcome: "refreshed", library, signal: true };
}

export type SuggestionsView =
  | { state: "empty-library" }
  | { state: "no-signal"; libraryCount: number }
  | { state: "unavailable"; libraryCount: number }
  | { state: "exhausted"; libraryCount: number }
  | { state: "ready"; libraryCount: number; page: Page<Suggestion>; updating: boolean };

/** What the suggestions page shows: refreshes first if the shelves changed. */
export async function loadSuggestions(store: DataStore, sources: SuggestionSources, limit = 12): Promise<SuggestionsView> {
  let result: RefreshResult;
  try {
    result = await refreshSuggestions(store, sources);
    // A refresh takes a few seconds at most (lookups time out at 4.5s). One that started longer ago
    // than that has failed and is backing off: don't make the reader wait for it.
    if (result.outcome === "busy" && (result.busyForMs ?? 0) < 8000) result = await waitForRefresh(store, sources, result, 8000 - (result.busyForMs ?? 0));
  } catch (err) {
    // A refresh failure never hides suggestions already made.
    console.error("[dogear suggestions] refresh failed", err);
    result = { outcome: "failed", library: await store.tasteLibrary(), signal: true };
  }
  const libraryCount = result.library.length;
  if (libraryCount === 0) return { state: "empty-library" };
  const page = await store.listSuggestions(null, limit);
  if (page.items.length > 0) return { state: "ready", libraryCount, page, updating: result.outcome === "busy" || result.outcome === "failed" };
  if (!result.signal) return { state: "no-signal", libraryCount };
  if (result.outcome === "failed" || result.outcome === "busy") return { state: "unavailable", libraryCount };
  return { state: "exhausted", libraryCount };
}

/**
 * Another request (usually the refresh right after a shelf move) is rebuilding the list: wait for it
 * briefly rather than show the old one. Gives up after a few seconds and shows what's saved.
 */
async function waitForRefresh(store: DataStore, sources: SuggestionSources, busy: RefreshResult, maxMs = 6000): Promise<RefreshResult> {
  const signature = librarySignature(busy.library);
  for (let waited = 0; waited < maxMs; waited += 600) {
    await new Promise((r) => setTimeout(r, 600));
    const state = await store.suggestionState();
    if (state?.signature === signature) return { ...busy, outcome: "fresh" };
    if (state?.refreshedAt && state.attemptedAt && Date.parse(state.refreshedAt) >= Date.parse(state.attemptedAt)) {
      return refreshSuggestions(store, sources);
    }
  }
  return busy;
}

export { LIMITS };
