"use client";

import { Check, FileUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { finishImportAction, importGoodreadsRowAction, type ImportOutcome } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { parseGoodreads, type GoodreadsRow } from "@/lib/goodreads";
import { cn } from "@/lib/utils";

type Result = { row: GoodreadsRow; outcome: ImportOutcome | "failed"; error?: string; book?: { title: string; slug: string } | null };
const SHELF_LABEL = { read: "Read", reading: "Reading", want_to_read: "Want to read", dnf: "Did not finish" } as const;
const OUTCOME: Record<Result["outcome"], { label: string; tone: string }> = {
  imported: { label: "Added", tone: "text-sage-deep" },
  updated: { label: "Updated", tone: "text-sage-deep" },
  skipped: { label: "Already on your shelves", tone: "text-ink-soft" },
  unmatched: { label: "Couldn't find it", tone: "text-burgundy" },
  unsupported: { label: "Shelf not imported", tone: "text-ink-soft" },
  failed: { label: "Failed", tone: "text-burgundy" },
};

/**
 * Goodreads import, in three steps: read the export (in the browser), preview it, then import
 * book by book with progress. Nothing is written until the reader says so; books already on
 * their shelves are left alone unless they choose to overwrite; misses can be retried.
 */
export function GoodreadsImport({ username }: { username: string }) {
  const [rows, setRows] = useState<GoodreadsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const stop = useRef(false);

  const read = async (file: File) => {
    setError(null);
    setResults([]);
    setDone(false);
    if (file.size > 10 * 1024 * 1024) return setError("That file is over 10 MB. A Goodreads export is usually much smaller: is it the right file?");
    const parsed = parseGoodreads(await file.text());
    if ("error" in parsed) return setError(parsed.error);
    if (!parsed.rows.length) return setError("No books found in that file.");
    setRows(parsed.rows);
  };

  const importRows = async (todo: GoodreadsRow[]) => {
    setRunning(true);
    setDone(false);
    stop.current = false;
    const queue = [...todo];
    // Two at a time: quick enough, gentle on Open Library.
    await Promise.all(
      [0, 1].map(async () => {
        while (queue.length && !stop.current) {
          const row = queue.shift()!;
          let r: Result;
          try {
            const res = await importGoodreadsRowAction(row, overwrite);
            r = res.ok ? { row, outcome: res.data.outcome, book: res.data.book } : { row, outcome: "failed", error: res.error };
          } catch {
            r = { row, outcome: "failed", error: "Connection lost" };
          }
          setResults((prev) => [...prev.filter((x) => x.row !== row), r]);
        }
      }),
    );
    await finishImportAction();
    setRunning(false);
    setDone(true);
  };

  if (!rows) {
    return (
      <div className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed border-line-strong bg-card px-6 py-12 text-center hover:border-ink focus-within:border-ink">
          <FileUp className="size-8 text-burgundy" strokeWidth={1.5} />
          <span className="font-serif text-2xl">Choose your Goodreads export</span>
          <span className="text-sm text-ink-soft">The .csv file from Goodreads → My Books → Import and export → Export library. It&rsquo;s read on this device.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {error && <p role="alert" className="text-sm text-burgundy">{error}</p>}
      </div>
    );
  }

  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.shelf ?? "other"] = (m[r.shelf ?? "other"] ?? 0) + 1), m), {});
  const finished = results.length;
  const byOutcome = (o: Result["outcome"]) => results.filter((r) => r.outcome === o);
  const retryable = [...byOutcome("failed"), ...byOutcome("unmatched")].map((r) => r.row);

  return (
    <div className="space-y-8">
      <section aria-labelledby="preview-h" className="paper p-5 sm:p-7">
        <h2 id="preview-h" className="text-2xl">{rows.length} books in your export</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(["read", "reading", "want_to_read", "dnf"] as const).map((k) => (
            <div key={k}>
              <dt className="meta">{SHELF_LABEL[k]}</dt>
              <dd className="font-serif text-3xl">{counts[k] ?? 0}</dd>
            </div>
          ))}
          <div>
            <dt className="meta">Other shelves</dt>
            <dd className="font-serif text-3xl">{counts.other ?? 0}</dd>
          </div>
        </dl>
        {(counts.other ?? 0) > 0 && <p className="mt-3 text-xs text-ink-soft">Books on other exclusive shelves (like &ldquo;owned&rdquo;) aren&rsquo;t imported: dogear. has no matching shelf.</p>}
        <table className="mt-6 w-full text-left text-sm">
          <caption className="sr-only">First books in your export</caption>
          <thead>
            <tr className="meta border-b border-line">
              <th className="py-2 font-normal">Title</th>
              <th className="hidden py-2 font-normal sm:table-cell">Author</th>
              <th className="py-2 font-normal">Shelf</th>
              <th className="hidden py-2 font-normal sm:table-cell">Rating</th>
              <th className="hidden py-2 font-normal md:table-cell">Read</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r, i) => (
              <tr key={i} className="border-b border-line/60">
                <td className="py-2 pr-3 font-serif">{r.title}</td>
                <td className="hidden py-2 pr-3 text-ink-soft sm:table-cell">{r.author}</td>
                <td className="py-2 pr-3">{r.shelf ? SHELF_LABEL[r.shelf] : <span className="text-ink-faint">{r.exclusiveShelf || "—"}</span>}</td>
                <td className="hidden py-2 pr-3 sm:table-cell">{r.rating ? `${r.rating}★` : "—"}</td>
                <td className="hidden py-2 md:table-cell">{r.dateRead ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 8 && <p className="meta mt-2 normal-case tracking-normal">and {rows.length - 8} more</p>}

        <div className="mt-6 space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-burgundy" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={running} />
            <span>
              Update books already on my dogear. shelves
              <span className="block text-xs text-ink-soft">Off: those are left exactly as they are. On: their shelf, rating and date read come from Goodreads.</span>
            </span>
          </label>
          <p className="text-xs text-ink-soft">Nothing is posted to your followers. Reviews and private notes from Goodreads aren&rsquo;t imported.</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {!running && !finished && <Button onClick={() => importRows(rows.filter((r) => r.shelf))}>Import {rows.filter((r) => r.shelf).length} books</Button>}
          {running && <Button variant="paper" onClick={() => (stop.current = true)}>Stop</Button>}
          {!running && <Button variant="ghost" onClick={() => (setRows(null), setResults([]), setDone(false))}>Choose another file</Button>}
        </div>
      </section>

      {finished > 0 && (
        <section aria-labelledby="progress-h" aria-live="polite">
          <h2 id="progress-h" className="flex items-center gap-2 text-2xl">
            {running && <Loader2 className="size-5 animate-spin text-burgundy" />}
            {running ? `Importing… ${finished} of ${rows.filter((r) => r.shelf).length}` : done ? "Done" : "Stopped"}
          </h2>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-shade" aria-hidden>
            <div className="h-full bg-burgundy transition-[width]" style={{ width: `${(finished / Math.max(1, rows.filter((r) => r.shelf).length)) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {byOutcome("imported").length} added · {byOutcome("updated").length} updated · {byOutcome("skipped").length} already on your shelves ·{" "}
            {byOutcome("unmatched").length} not found · {byOutcome("failed").length} failed
          </p>
          {done && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/home" className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm text-paper hover:bg-burgundy"><Check className="size-4" /> See your shelves</Link>
              <Link href={`/u/${username}/recap`} className="inline-flex h-10 items-center border border-line-strong px-4 text-sm hover:border-ink">Your yearbook</Link>
              {retryable.length > 0 && <Button variant="paper" onClick={() => importRows(retryable)}>Try the {retryable.length} again</Button>}
            </div>
          )}
          {retryable.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-y border-line text-sm">
              {[...byOutcome("unmatched"), ...byOutcome("failed")].map((r, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    <span className="font-serif">{r.row.title}</span> <span className="text-ink-soft">· {r.row.author}</span>
                  </span>
                  <span className={cn("text-xs", OUTCOME[r.outcome].tone)}>
                    {OUTCOME[r.outcome].label}
                    {r.error ? `: ${r.error}` : ""}
                    {r.outcome === "unmatched" && (
                      <Link href={`/search?q=${encodeURIComponent(`${r.row.title} ${r.row.author}`)}`} className="ml-2 underline">search</Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
