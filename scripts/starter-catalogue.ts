/**
 * Starter catalogue: real books from Open Library, so Discover, search and mood pages have
 * something to show on day one. Books only — never readers, reviews or activity.
 *
 *   npm run catalogue:starter                       # dry run: prints what it would add
 *   npm run catalogue:starter -- --apply --project <project-ref>
 *   npm run catalogue:starter -- --enrich-moods --apply --project <project-ref>
 *
 * --apply writes with SUPABASE_SERVICE_ROLE_KEY and only when --project matches the
 * configured NEXT_PUBLIC_SUPABASE_URL (so it can't hit the wrong project by accident).
 * Idempotent: a book already in the catalogue (same Open Library work or ISBN) is skipped.
 * --enrich-moods fills in moods (and empty genres) for existing Open Library books.
 */
import { createClient } from "@supabase/supabase-js";
import { getOpenLibraryWork, searchOpenLibrary } from "../src/lib/openlibrary";
import { slugify } from "../src/lib/utils";
import type { BookInput } from "../src/lib/types";

// "Title | Author": a deliberately mixed shelf across genres, eras and moods.
const STARTER = `
Piranesi | Susanna Clarke
Jonathan Strange & Mr Norrell | Susanna Clarke
The Secret History | Donna Tartt
The Goldfinch | Donna Tartt
Normal People | Sally Rooney
Circe | Madeline Miller
The Song of Achilles | Madeline Miller
Never Let Me Go | Kazuo Ishiguro
The Remains of the Day | Kazuo Ishiguro
Klara and the Sun | Kazuo Ishiguro
Kafka on the Shore | Haruki Murakami
Norwegian Wood | Haruki Murakami
Beloved | Toni Morrison
Song of Solomon | Toni Morrison
A Wizard of Earthsea | Ursula K. Le Guin
The Left Hand of Darkness | Ursula K. Le Guin
The Dispossessed | Ursula K. Le Guin
We Have Always Lived in the Castle | Shirley Jackson
The Haunting of Hill House | Shirley Jackson
Pride and Prejudice | Jane Austen
Persuasion | Jane Austen
Emma | Jane Austen
On Earth We're Briefly Gorgeous | Ocean Vuong
Babel | R. F. Kuang
Mrs Dalloway | Virginia Woolf
To the Lighthouse | Virginia Woolf
Orlando | Virginia Woolf
Kindred | Octavia E. Butler
Parable of the Sower | Octavia E. Butler
The Seven Husbands of Evelyn Hugo | Taylor Jenkins Reid
Crime and Punishment | Fyodor Dostoevsky
The Brothers Karamazov | Fyodor Dostoevsky
Notes from Underground | Fyodor Dostoevsky
Anna Karenina | Leo Tolstoy
The Stranger | Albert Camus
The Plague | Albert Camus
The Myth of Sisyphus | Albert Camus
Middlemarch | George Eliot
Jane Eyre | Charlotte Brontë
Wuthering Heights | Emily Brontë
Frankenstein | Mary Shelley
Dracula | Bram Stoker
Rebecca | Daphne du Maurier
The Picture of Dorian Gray | Oscar Wilde
Great Expectations | Charles Dickens
Little Women | Louisa May Alcott
Anne of Green Gables | L. M. Montgomery
The Great Gatsby | F. Scott Fitzgerald
Giovanni's Room | James Baldwin
Their Eyes Were Watching God | Zora Neale Hurston
One Hundred Years of Solitude | Gabriel García Márquez
Love in the Time of Cholera | Gabriel García Márquez
The Master and Margarita | Mikhail Bulgakov
Stoner | John Williams
A Little Life | Hanya Yanagihara
Gilead | Marilynne Robinson
Housekeeping | Marilynne Robinson
The Bell Jar | Sylvia Plath
The Handmaid's Tale | Margaret Atwood
Cat's Eye | Margaret Atwood
The God of Small Things | Arundhati Roy
Pachinko | Min Jin Lee
Never Let Me Go | Kazuo Ishiguro
The Night Circus | Erin Morgenstern
The Starless Sea | Erin Morgenstern
Howl's Moving Castle | Diana Wynne Jones
The Hobbit | J. R. R. Tolkien
A Psalm for the Wild-Built | Becky Chambers
The House in the Cerulean Sea | TJ Klune
Mexican Gothic | Silvia Moreno-Garcia
The Name of the Rose | Umberto Eco
If on a Winter's Night a Traveler | Italo Calvino
Invisible Cities | Italo Calvino
The Remains of the Day | Kazuo Ishiguro
Station Eleven | Emily St. John Mandel
Sea of Tranquility | Emily St. John Mandel
Dune | Frank Herbert
The Left Hand of Darkness | Ursula K. Le Guin
Project Hail Mary | Andy Weir
Rebecca | Daphne du Maurier
Gone Girl | Gillian Flynn
The Talented Mr. Ripley | Patricia Highsmith
And Then There Were None | Agatha Christie
The Murder of Roger Ackroyd | Agatha Christie
The Hound of the Baskervilles | Arthur Conan Doyle
Lonesome Dove | Larry McMurtry
Wolf Hall | Hilary Mantel
The Remains of the Day | Kazuo Ishiguro
Just Kids | Patti Smith
H Is for Hawk | Helen Macdonald
The Year of Magical Thinking | Joan Didion
Slouching Towards Bethlehem | Joan Didion
Bluets | Maggie Nelson
A Room of One's Own | Virginia Woolf
Meditations | Marcus Aurelius
Letters to a Young Poet | Rainer Maria Rilke
Braiding Sweetgrass | Robin Wall Kimmerer
The Little Prince | Antoine de Saint-Exupéry
Ariel | Sylvia Plath
Devotions | Mary Oliver
The Odyssey | Homer
Siddhartha | Hermann Hesse
Things Fall Apart | Chinua Achebe
Americanah | Chimamanda Ngozi Adichie
Convenience Store Woman | Sayaka Murata
Before the Coffee Gets Cold | Toshikazu Kawaguchi
The Midnight Library | Matt Haig
Tomorrow, and Tomorrow, and Tomorrow | Gabrielle Zevin
`;

const args = new Set(process.argv.slice(2));
const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const apply = args.has("--apply");
const enrich = args.has("--enrich-moods");
const COVER = /^https:\/\/covers\.openlibrary\.org\/b\/(id|isbn|olid)\/[A-Za-z0-9-]+\.jpg(\?default=false)?$/;

function admin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const project = flag("--project");
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apply.");
  if (!project || new URL(url).hostname.split(".")[0] !== project) {
    throw new Error(`--project must match the configured Supabase project (${new URL(url).hostname.split(".")[0]}). Refusing to write.`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Validate the way the database will, so a bad record is reported here instead of failing there. */
function valid(b: BookInput): string | null {
  if (!b.title || b.title.length > 300) return "title";
  if (!b.authors.length) return "no author";
  if (b.coverUrl && !COVER.test(b.coverUrl)) return "cover host";
  if (b.isbn13 && !/^97[89]\d{10}$/.test(b.isbn13)) return "isbn13";
  return null;
}

/** Accent- and punctuation-insensitive, for matching "Dostoevsky" with "Dostoïevski". */
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Open Library times out under load; try again before giving up (null / [] mean "no answer"). */
async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last = await fn();
  for (let i = 1; i < tries && (last == null || (Array.isArray(last) && last.length === 0)); i++) {
    await new Promise((r) => setTimeout(r, 1500 * i));
    last = await fn();
  }
  return last;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function starter() {
  const wanted = [...new Set(STARTER.trim().split("\n").map((l) => l.trim()).filter(Boolean))].map((l) => {
    const [title, author] = l.split("|").map((s) => s.trim());
    return { title, author };
  });
  console.log(`Looking up ${wanted.length} books on Open Library…`);
  const found = await pool(wanted, 3, async ({ title, author }) => {
    // Best match for "title author", in English; then the full record for that work and edition.
    const results = await retry(() => searchOpenLibrary(`${title} ${author}`, 8));
    const surname = norm(author.split(" ").at(-1)!).slice(0, 5);
    const byAuthor = results.filter((b) => b.authors.some((a) => norm(a).includes(surname)) || norm(b.title).startsWith(norm(title)));
    // Prefer the book itself over collections and study guides that merely contain the title.
    const hit = byAuthor.find((b) => norm(b.title) === norm(title)) ?? byAuthor.find((b) => norm(b.title).startsWith(norm(title))) ?? byAuthor[0];
    if (!hit?.olWorkId) return { title, author, book: null, why: "not found" };
    const book = await retry(() => getOpenLibraryWork(hit.olWorkId!, hit.olEditionId));
    if (!book) return { title, author, book: null, why: "work record unavailable" };
    book.coverUrl ??= hit.coverUrl;
    book.pageCount ??= hit.pageCount;
    const problem = valid(book);
    return { title, author, book: problem ? null : book, why: problem };
  });

  const ok = found.filter((f) => f.book).map((f) => f.book!) as BookInput[];
  const byWork = new Map(ok.map((b) => [b.olWorkId, b]));
  const books = [...byWork.values()];
  for (const f of found.filter((x) => !x.book)) console.log(`  skipped  ${f.title} (${f.author}): ${f.why}`);
  console.log(`\n${books.length} books ready, ${books.filter((b) => b.moods.length).length} with moods, ${books.filter((b) => b.coverUrl).length} with covers.`);

  if (!apply) {
    for (const b of books) console.log(`  ${b.title} — ${b.authors[0]} [${b.genres.join(", ")}] {${b.moods.join(", ")}}`);
    console.log("\nDry run. Nothing written. Add --apply --project <ref> to import.");
    return;
  }
  const sb = admin();
  const { data: existing, error } = await sb.from("books").select("ol_work_id, isbn13, slug");
  if (error) throw error;
  const haveWork = new Set((existing ?? []).map((r) => r.ol_work_id).filter(Boolean));
  const haveIsbn = new Set((existing ?? []).map((r) => r.isbn13).filter(Boolean));
  const slugs = new Set((existing ?? []).map((r) => r.slug));
  let added = 0;
  for (const b of books) {
    if (haveWork.has(b.olWorkId) || (b.isbn13 && haveIsbn.has(b.isbn13))) continue;
    let slug = slugify(`${b.title} ${b.authors[0] ?? ""}`);
    if (slugs.has(slug)) slug = `${slug}-${(b.olWorkId ?? "").toLowerCase()}`;
    const { error: e } = await sb.from("books").insert({
      slug, title: b.title, subtitle: b.subtitle, authors: b.authors, description: b.description, cover_url: b.coverUrl,
      isbn13: b.isbn13 && !haveIsbn.has(b.isbn13) ? b.isbn13 : null, isbn10: b.isbn10, ol_work_id: b.olWorkId, ol_edition_id: b.olEditionId,
      published_year: b.publishedYear, publisher: b.publisher, page_count: b.pageCount, language: b.language, genres: b.genres, moods: b.moods,
    });
    if (e) {
      console.log(`  failed   ${b.title}: ${e.message}`);
      continue;
    }
    slugs.add(slug);
    added += 1;
  }
  console.log(`Added ${added} books (${books.length - added} were already in the catalogue).`);
}

async function enrichMoods() {
  const sb = apply ? admin() : null;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const reader = sb ?? createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await reader.from("books").select("id, title, ol_work_id, ol_edition_id, genres, moods").not("ol_work_id", "is", null);
  if (error) throw error;
  const todo = (data ?? []).filter((b) => !b.moods?.length);
  console.log(`${todo.length} Open Library books without moods.`);
  await pool(todo, 4, async (b) => {
    const work = await getOpenLibraryWork(b.ol_work_id, b.ol_edition_id);
    if (!work) return console.log(`  skipped  ${b.title}: work record unavailable`);
    const patch = { moods: work.moods, ...(b.genres?.length ? {} : { genres: work.genres }) };
    console.log(`  ${b.title}: {${work.moods.join(", ") || "no mood signals"}}`);
    if (sb && work.moods.length) {
      const { error: e } = await sb.from("books").update(patch).eq("id", b.id);
      if (e) console.log(`  failed   ${b.title}: ${e.message}`);
    }
  });
  if (!sb) console.log("\nDry run. Nothing written. Add --apply --project <ref> to save.");
}

(enrich ? enrichMoods() : starter()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
