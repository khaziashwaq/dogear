import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getStore } from "@/lib/auth";
import { SHARE_TEMPLATES, type ShareTemplate } from "@/lib/share-cards";
import type { HighlightColour } from "@/lib/types";
import { authorLine, excerpt } from "@/lib/utils";

/*
  Share cards for an annotation, composed with next/og (not screenshotted).

  ?template = minimal | vintage | scrapbook | dark
  ?format   = portrait (1080×1350 post) | story (1080×1920) | og (1200×630 link preview)
*/

const TEMPLATES: readonly string[] = SHARE_TEMPLATES.map((t) => t.key);

const THEME: Record<ShareTemplate, { bg: string; paper: string; ink: string; soft: string; accent: string; rule: string }> = {
  minimal: { bg: "#F5F0E7", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", rule: "#292C27" },
  vintage: { bg: "#E9D9A8", paper: "#F3E8C6", ink: "#3B2A1E", soft: "#6B5640", accent: "#743F48", rule: "#743F48" },
  scrapbook: { bg: "#A6AC91", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", rule: "#D9A9A0" },
  dark: { bg: "#1F2420", paper: "#292C27", ink: "#F0E6CF", soft: "#BDB39A", accent: "#E9D9A8", rule: "#E9D9A8" },
};

// The reader's highlighter, on light paper and (muted further) on dark.
const HIGHLIGHT: Record<HighlightColour, { light: string; dark: string }> = {
  butter: { light: "rgba(233,210,140,0.78)", dark: "rgba(233,210,140,0.28)" },
  sage: { light: "rgba(166,180,140,0.6)", dark: "rgba(166,180,140,0.28)" },
  rose: { light: "rgba(217,160,150,0.55)", dark: "rgba(217,160,150,0.28)" },
  lavender: { light: "rgba(186,172,222,0.55)", dark: "rgba(186,172,222,0.3)" },
  blue: { light: "rgba(150,186,218,0.55)", dark: "rgba(150,186,218,0.3)" },
};

const fontDir = path.join(process.cwd(), "src/assets/fonts");

export async function GET(req: Request, ctx: RouteContext<"/quotes/[id]/card">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const store = await getStore();
  const quote = await store.getQuote(id);
  // Only published, public annotations get an image anyone can fetch.
  if (!quote || quote.isDraft || quote.visibility !== "public") return new Response("Not found", { status: 404 });

  const t = (TEMPLATES.includes(url.searchParams.get("template") ?? "") ? url.searchParams.get("template") : "minimal") as ShareTemplate;
  const format = url.searchParams.get("format") === "story" ? "story" : url.searchParams.get("format") === "og" ? "og" : "portrait";
  const [W, H] = format === "story" ? [1080, 1920] : format === "og" ? [1200, 630] : [1080, 1350];
  const theme = THEME[t];
  const hl = HIGHLIGHT[quote.highlight][t === "dark" ? "dark" : "light"];

  const [serif, serifItalic, mono, hand] = await Promise.all(
    ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Italic.ttf", "DMMono-Regular.ttf", "Caveat-Medium.ttf"].map((f) => readFile(path.join(fontDir, f))),
  );

  const maxPassage = format === "og" ? 220 : format === "story" ? 620 : 460;
  const passage = excerpt(quote.body, maxPassage);
  const len = passage.length;
  const passageSize =
    format === "og" ? (len < 90 ? 46 : len < 160 ? 36 : 30)
    : format === "story" ? (len < 90 ? 84 : len < 200 ? 66 : len < 360 ? 54 : 44)
    : len < 90 ? 76 : len < 200 ? 58 : len < 320 ? 48 : 40;
  const thoughts = quote.commentary ? excerpt(quote.commentary, format === "og" ? 90 : 180) : null;
  const pad = format === "og" ? 56 : 80;
  const who = quote.author.displayName || `@${quote.author.username}`;

  const Passage = (
    <div style={{ display: "flex", position: "relative", marginLeft: -14 }}>
      {/* the highlighter: a stroke laid down behind the words */}
      <div style={{ position: "absolute", top: passageSize * 0.12, bottom: passageSize * 0.05, left: 0, right: 0, background: hl, borderRadius: 6, transform: "rotate(-0.4deg)" }} />
      <div style={{ display: "flex", padding: `${passageSize * 0.18}px 14px`, fontFamily: t === "scrapbook" ? "SerifItalic" : "Serif", fontSize: passageSize, lineHeight: 1.32, color: theme.ink }}>
        {passage}
      </div>
    </div>
  );

  const Source = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: format === "og" ? 30 : 40, lineHeight: 1.1, color: theme.ink }}>{quote.book.title.slice(0, 70)}</div>
      <div style={{ display: "flex", fontFamily: "SerifItalic", fontSize: format === "og" ? 22 : 28, color: theme.soft, marginTop: 6 }}>
        {authorLine(quote.book.authors)}
        {quote.page ? `, p. ${quote.page}` : ""}
      </div>
    </div>
  );

  const Brand = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ display: "flex", fontSize: format === "og" ? 38 : 50, color: theme.ink }}>
        dogear<span style={{ color: theme.accent }}>.</span>
      </div>
      <div style={{ display: "flex", fontFamily: "Mono", fontSize: format === "og" ? 16 : 20, color: theme.soft }}>@{quote.author.username}</div>
    </div>
  );

  const Thoughts = thoughts ? (
    <div style={{ display: "flex", borderLeft: `4px solid ${theme.accent}`, paddingLeft: 22, marginTop: format === "og" ? 18 : 40, fontFamily: "Hand", fontSize: format === "og" ? 30 : 46, lineHeight: 1.15, color: theme.accent }}>
      {thoughts}
    </div>
  ) : null;

  const framed = t === "vintage" || t === "scrapbook";
  const card = (
    <div style={{ display: "flex", width: "100%", height: "100%", background: theme.bg, padding: framed ? pad * 0.55 : 0, fontFamily: "Serif", position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          padding: pad,
          background: framed ? theme.paper : theme.bg,
          ...(t === "vintage" ? { border: `3px solid ${theme.rule}` } : {}),
          ...(t === "scrapbook" ? { transform: "rotate(-1deg)", boxShadow: "0 30px 50px -24px rgba(41,44,39,0.6)" } : {}),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: t === "scrapbook" ? "Hand" : "SerifItalic", fontSize: format === "og" ? 24 : t === "scrapbook" ? 40 : 30, color: theme.accent }}>
          <div style={{ display: "flex" }}>{t === "scrapbook" ? `dog-eared by ${who}` : `Marked by ${who}`}</div>
          {t === "dark" && <div style={{ display: "flex" }}>marginalia</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: format === "og" ? 16 : 32, marginBottom: format === "og" ? 16 : 32 }}>
          {Passage}
          {Thoughts}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `${t === "scrapbook" ? "3px dashed" : "2px solid"} ${theme.rule}`, paddingTop: format === "og" ? 16 : 26 }}>
          {Source}
          {Brand}
        </div>
      </div>
      {t === "scrapbook" && (
        <div style={{ display: "flex", position: "absolute", top: pad * 0.25, left: W / 2 - 90, width: 180, height: 46, background: "rgba(233,217,168,0.85)", transform: "rotate(-4deg)" }} />
      )}
    </div>
  );

  return new ImageResponse(card, {
    width: W,
    height: H,
    fonts: [
      { name: "Serif", data: serif, style: "normal" },
      { name: "SerifItalic", data: serifItalic, style: "normal" },
      { name: "Mono", data: mono, style: "normal" },
      { name: "Hand", data: hand, style: "normal" },
    ],
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
