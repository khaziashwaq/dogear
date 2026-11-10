import assert from "node:assert/strict";
import { test } from "node:test";
import { MOOD_RULES, subjectsToMoods } from "../../src/lib/moods.ts";
import { MOODS } from "../../src/lib/data/seed/books.ts";

test("every mood dogear. offers has a rule (so mood pages always have Open Library books)", () => {
  for (const m of MOODS) {
    assert.ok(MOOD_RULES[m.key], `no rule for ${m.key}`);
    assert.ok(MOOD_RULES[m.key].subjects.length > 0);
  }
});

test("subjects map to at most three moods, strongest first", () => {
  const moods = subjectsToMoods(["Grief", "Loss (Psychology)", "Bereavement", "Love stories", "Courtship", "Fiction"]);
  assert.deepEqual(moods, ["melancholic", "romantic", "heartbreaking"]);
});

test("no signals, no moods (never guessed)", () => {
  assert.deepEqual(subjectsToMoods(["Accessible book", "Protected DAISY", "In library"]), []);
  assert.deepEqual(subjectsToMoods(), []);
});
