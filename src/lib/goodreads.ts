// Goodreads' "Export Library" CSV, parsed in the browser (the file never leaves the device;
// only one book at a time is sent to the server to import).

export interface GoodreadsRow {
  title: string;
  author: string;
  isbn: string | null;
  isbn13: string | null;
  /** 1–5, or null when unrated (Goodreads writes 0). */
  rating: number | null;
  shelf: "read" | "reading" | "want_to_read" | "dnf" | null;
  /** The raw exclusive shelf, for rows we can't place. */
  exclusiveShelf: string;
  /** YYYY-MM-DD. */
  dateRead: string | null;
  /** Other Goodreads shelves (tags). */
  shelves: string[];
}

/** RFC 4180: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

// Goodreads wraps ISBNs as ="0141439513" so spreadsheets keep the leading zero.
const isbnOf = (v: string | undefined) => {
  const d = (v ?? "").replace(/[^0-9X]/gi, "").toUpperCase();
  return d.length === 10 || d.length === 13 ? d : null;
};
const SHELF: Record<string, GoodreadsRow["shelf"]> = {
  read: "read",
  "currently-reading": "reading",
  "to-read": "want_to_read",
  "did-not-finish": "dnf",
  dnf: "dnf",
  abandoned: "dnf",
};

/** Rows from a Goodreads export, or a message saying what's wrong with the file. */
export function parseGoodreads(text: string): { rows: GoodreadsRow[] } | { error: string } {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { error: "That file is empty." };
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const at = { title: col("title"), author: col("author"), isbn: col("isbn"), isbn13: col("isbn13"), rating: col("my rating"), shelf: col("exclusive shelf"), read: col("date read"), shelves: col("bookshelves") };
  if (at.title < 0 || at.author < 0 || at.shelf < 0) {
    return { error: "This doesn't look like a Goodreads export. On Goodreads: My Books → Import and export → Export library." };
  }
  const rows = lines.map((f): GoodreadsRow => {
    const exclusive = (f[at.shelf] ?? "").trim().toLowerCase();
    const rating = Number(f[at.rating]);
    const date = (f[at.read] ?? "").trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    return {
      title: (f[at.title] ?? "").trim().slice(0, 300),
      author: (f[at.author] ?? "").trim().slice(0, 120),
      isbn: isbnOf(f[at.isbn]),
      isbn13: isbnOf(f[at.isbn13]),
      rating: rating >= 1 && rating <= 5 ? rating : null,
      shelf: SHELF[exclusive] ?? null,
      exclusiveShelf: exclusive,
      dateRead: date ? `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}` : null,
      shelves: (f[at.shelves] ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && s !== exclusive && !SHELF[s])
        .slice(0, 10),
    };
  });
  return { rows: rows.filter((r) => r.title) };
}
