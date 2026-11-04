import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string, max = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "") || "book";
}

export function isOlWorkId(value: string): boolean {
  return /^OL\d+W$/.test(value);
}

export function coverFromIsbn(isbn: string, size: "S" | "M" | "L" = "L") {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}

export function coverFromId(id: number | string, size: "S" | "M" | "L" = "L") {
  return `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`;
}

/** Normalise a rating to the nearest half star between 0.5 and 5, or null. */
export function normaliseRating(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (n == null || Number.isNaN(n) || n <= 0) return null;
  return Math.min(5, Math.max(0.5, Math.round(n * 2) / 2));
}

export function authorLine(authors: string[]): string {
  if (authors.length === 0) return "Unknown author";
  if (authors.length <= 2) return authors.join(" & ");
  return `${authors[0]} et al.`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (d < 30) return `${w}w`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d > 330 ? "numeric" : undefined });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Deterministic small hash for picking palettes, rotations, etc. */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A tasteful, deterministic tilt in degrees for scrapbook-y elements. */
export function tilt(seed: string, max = 2): number {
  return ((hash(seed) % 1000) / 1000) * max * 2 - max;
}

export function excerpt(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;
