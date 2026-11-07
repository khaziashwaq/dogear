import { hash } from "@/lib/utils";

/** Typeset-jacket colours, shared by covers, spines and share cards so a coverless book looks the same everywhere. */
export const JACKET_PALETTES = [
  { bg: "#743F48", fg: "#E9D9A8", accent: "#D9A9A0" },
  { bg: "#A6AC91", fg: "#292C27", accent: "#F5F0E7" },
  { bg: "#D9A9A0", fg: "#5A2F37", accent: "#F5F0E7" },
  { bg: "#E9D9A8", fg: "#292C27", accent: "#743F48" },
  { bg: "#292C27", fg: "#F5F0E7", accent: "#D9A9A0" },
  { bg: "#7D8468", fg: "#F5F0E7", accent: "#E9D9A8" },
];

export function jacketColours(title: string, authors: string[]) {
  return JACKET_PALETTES[hash(title + authors.join()) % JACKET_PALETTES.length];
}
