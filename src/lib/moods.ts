// How a book gets its moods. Open Library has no moods, only subject headings, so each of
// dogear.'s moods is defined by the headings that signal it: a book whose subjects match a
// mood's pattern gets that mood (at most three, strongest first). The same headings power
// discovery: a mood page always has Open Library books to show, even before readers add any.
// Keep keys in step with MOODS in src/lib/data/seed/books.ts.

export interface MoodRule {
  /** Matches Open Library subject headings (case-insensitive). */
  pattern: RegExp;
  /** Open Library subject slugs for discovery, largest first. */
  subjects: string[];
}

export const MOOD_RULES: Record<string, MoodRule> = {
  melancholic: { pattern: /\b(grief|melanchol|loneliness|bereavement|loss \(psychology\)|elegi)/i, subjects: ["grief", "loneliness"] },
  heartbreaking: { pattern: /\b(tragedy|tragic|death|dying|terminal|holocaust|grief)/i, subjects: ["tragedy", "grief"] },
  unsettling: { pattern: /\b(horror|ghost|haunted|psychological fiction|paranoia|dystopi|supernatural)/i, subjects: ["horror", "psychological_fiction"] },
  hopeful: { pattern: /\b(hope|resilien|healing|recovery|redemption|kindness)/i, subjects: ["hope", "friendship"] },
  dreamy: { pattern: /\b(magic realism|magical realism|fairy tales?|dreams|surreal|fables)/i, subjects: ["fairy_tales", "dreams"] },
  funny: { pattern: /\b(humou?r|comedy|comic|satire|wit and humor)/i, subjects: ["humor", "satire"] },
  tense: { pattern: /\b(thriller|suspense|espionage|spy stories|murder|detective)/i, subjects: ["suspense", "thrillers"] },
  romantic: { pattern: /\b(love stories|romance|courtship|man-woman relationships)/i, subjects: ["love_stories", "romance"] },
  reflective: { pattern: /\b(philosoph|existential|meditation|essays|ethics|spiritual)/i, subjects: ["philosophy", "essays"] },
  adventurous: { pattern: /\b(adventure|voyages|travel|quests|exploration|sea stories|survival)/i, subjects: ["adventure_stories", "voyages_and_travels"] },
  cosy: { pattern: /\b(friendship|village|small town|country life|cats|tea|bookstores)/i, subjects: ["friendship", "family_life"] },
  "rainy-day": { pattern: /\b(domestic fiction|family life|families|letters|sisters|brothers and sisters)/i, subjects: ["domestic_fiction", "family_life"] },
};

/** Moods for a book from its subject headings: the three with the most matching headings. */
export function subjectsToMoods(subjects: string[] = []): string[] {
  const heads = subjects.slice(0, 60);
  return Object.entries(MOOD_RULES)
    .map(([mood, rule]) => [mood, heads.filter((h) => rule.pattern.test(h)).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mood]) => mood);
}
