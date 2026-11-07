"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * A book's spine colour, read from its own cover art.
 *
 * Real jackets wrap round the spine, so the dominant colour of the cover's
 * left-hand side is a good stand-in. We sample the small Open Library
 * thumbnail (which is served with CORS) on a tiny canvas, pick the most common
 * colour bucket — weighted toward saturated colours so a white title block
 * doesn't win — and choose ink or cream lettering for contrast.
 */
export interface Swatch {
  bg: string;
  fg: string;
}

const INK = "#292c27";
const CREAM = "#f6efe2";
const STORAGE_KEY = "dogear:spines:v1";

const memory = new Map<string, Promise<Swatch | null>>();
let stored: Record<string, Swatch | null> | null = null;

function storage(): Record<string, Swatch | null> {
  if (stored) return stored;
  try {
    stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    stored = {};
  }
  return stored!;
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function remember(url: string, swatch: Swatch | null) {
  const s = storage();
  s[url] = swatch;
  listeners.forEach((l) => l());
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — the in-memory cache still works */
  }
}

function luminance(r: number, g: number, b: number) {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

async function sample(url: string): Promise<Swatch | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = url.replace(/-[LM]\.jpg/, "-S.jpg");
  try {
    await img.decode();
  } catch {
    return null;
  }
  if (img.naturalWidth < 20) return null;

  const w = 10;
  const h = 16;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, img.naturalWidth * 0.45, img.naturalHeight, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas: the host didn't send CORS headers
  }

  const buckets = new Map<number, { r: number; g: number; b: number; n: number; weight: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, weight: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    bucket.weight += 1 + sat * 1.5;
    buckets.set(key, bucket);
  }
  let best: { r: number; g: number; b: number; n: number; weight: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.weight > best.weight) best = bucket;
  if (!best) return null;
  const [r, g, b] = [best.r / best.n, best.g / best.n, best.b / best.n].map(Math.round);
  return { bg: `rgb(${r} ${g} ${b})`, fg: luminance(r, g, b) > 0.36 ? INK : CREAM };
}

function swatchFor(url: string): Promise<Swatch | null> {
  let p = memory.get(url);
  if (!p) {
    p = sample(url).then((s) => {
      remember(url, s);
      return s;
    });
    memory.set(url, p);
  }
  return p;
}

/** `null` until sampled, or when the cover can't be read — fall back to the jacket palette. */
export function useSpineColour(coverUrl: string | null): Swatch | null {
  const swatch = useSyncExternalStore(
    subscribe,
    () => (coverUrl ? storage()[coverUrl] : undefined),
    () => undefined, // server and hydration render use the jacket palette
  );
  useEffect(() => {
    if (coverUrl && storage()[coverUrl] === undefined) void swatchFor(coverUrl);
  }, [coverUrl]);
  return swatch ?? null;
}
