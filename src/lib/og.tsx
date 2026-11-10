import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { SHARE_TEMPLATES, type ShareTemplate } from "@/lib/share-cards";

// Shared pieces for the share images made with next/og (satori): the four templates, the
// three sizes, fonts, and the paper frame. Satori: every element needs display flex; no
// outline / "none" values.

export const THEME: Record<ShareTemplate, { bg: string; paper: string; ink: string; soft: string; accent: string; rule: string }> = {
  minimal: { bg: "#F5F0E7", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", rule: "#292C27" },
  vintage: { bg: "#E9D9A8", paper: "#F3E8C6", ink: "#3B2A1E", soft: "#6B5640", accent: "#743F48", rule: "#743F48" },
  scrapbook: { bg: "#A6AC91", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", rule: "#D9A9A0" },
  dark: { bg: "#1F2420", paper: "#292C27", ink: "#F0E6CF", soft: "#BDB39A", accent: "#E9D9A8", rule: "#E9D9A8" },
};

export type CardFormat = "portrait" | "story" | "og";
export const SIZES: Record<CardFormat, [number, number]> = { portrait: [1080, 1350], story: [1080, 1920], og: [1200, 630] };

export function cardParams(url: URL) {
  const raw = url.searchParams.get("template") ?? "";
  const template = (SHARE_TEMPLATES.some((t) => t.key === raw) ? raw : "minimal") as ShareTemplate;
  const f = url.searchParams.get("format");
  const format: CardFormat = f === "story" ? "story" : f === "og" ? "og" : "portrait";
  return { template, format, size: SIZES[format], theme: THEME[template] };
}

const fontDir = path.join(process.cwd(), "src/assets/fonts");
export async function cardFonts() {
  const [serif, serifItalic, mono, hand] = await Promise.all(
    ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Italic.ttf", "DMMono-Regular.ttf", "Caveat-Medium.ttf"].map((f) => readFile(path.join(fontDir, f))),
  );
  return [
    { name: "Serif", data: serif, style: "normal" as const },
    { name: "SerifItalic", data: serifItalic, style: "normal" as const },
    { name: "Mono", data: mono, style: "normal" as const },
    { name: "Hand", data: hand, style: "normal" as const },
  ];
}

/** The paper the card sits on, per template (framed for vintage and scrapbook, taped for scrapbook). */
export function CardFrame({ template, format, width, children }: { template: ShareTemplate; format: CardFormat; width: number; children: ReactNode }) {
  const theme = THEME[template];
  const pad = format === "og" ? 56 : 80;
  const framed = template === "vintage" || template === "scrapbook";
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: theme.bg, padding: framed ? pad * 0.55 : 0, fontFamily: "Serif", position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: pad,
          background: framed ? theme.paper : theme.bg,
          ...(template === "vintage" ? { border: `3px solid ${theme.rule}` } : {}),
          ...(template === "scrapbook" ? { transform: "rotate(-1deg)", boxShadow: "0 30px 50px -24px rgba(41,44,39,0.6)" } : {}),
        }}
      >
        {children}
      </div>
      {template === "scrapbook" && (
        <div style={{ display: "flex", position: "absolute", top: pad * 0.25, left: width / 2 - 90, width: 180, height: 46, background: "rgba(233,217,168,0.85)", transform: "rotate(-4deg)" }} />
      )}
    </div>
  );
}

/** "dogear." and the reader's handle, bottom right. */
export function CardBrand({ template, format, username }: { template: ShareTemplate; format: CardFormat; username: string | null }) {
  const theme = THEME[template];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ display: "flex", fontSize: format === "og" ? 38 : 50, color: theme.ink }}>
        dogear<span style={{ color: theme.accent }}>.</span>
      </div>
      {username && <div style={{ display: "flex", fontFamily: "Mono", fontSize: format === "og" ? 16 : 20, color: theme.soft }}>@{username}</div>}
    </div>
  );
}

/** A book: its real cover, or a typeset jacket when there isn't one. */
export function CardCover({ title, coverUrl, w, template }: { title: string; coverUrl: string | null; w: number; template: ShareTemplate }) {
  const theme = THEME[template];
  const h = Math.round(w * 1.5);
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- rendered by satori, not the browser
    return <img src={coverUrl.replace("-L.jpg", "-M.jpg")} width={w} height={h} alt="" style={{ objectFit: "cover", borderRadius: 3, boxShadow: "0 10px 18px -8px rgba(0,0,0,0.45)" }} />;
  }
  return (
    <div style={{ display: "flex", width: w, height: h, background: theme.accent, color: theme.paper, padding: w * 0.1, fontSize: Math.max(14, w * 0.12), lineHeight: 1.1, borderRadius: 3 }}>
      {title.slice(0, 40)}
    </div>
  );
}

export const cardHeaders = { "Cache-Control": "public, max-age=300, s-maxage=3600" };
