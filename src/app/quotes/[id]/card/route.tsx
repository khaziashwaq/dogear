import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getStore } from "@/lib/auth";
import { authorLine, hash } from "@/lib/utils";

// Instagram-portrait (4:5) quote card, typeset in the brand fonts.
const PALETTES = [
  { bg: "#F5F0E7", panel: "#D9A9A0", ink: "#292C27", accent: "#743F48" },
  { bg: "#292C27", panel: "#743F48", ink: "#F5F0E7", accent: "#E9D9A8" },
  { bg: "#E9D9A8", panel: "#A6AC91", ink: "#292C27", accent: "#743F48" },
  { bg: "#A6AC91", panel: "#F5F0E7", ink: "#292C27", accent: "#743F48" },
];

const fontDir = path.join(process.cwd(), "src/assets/fonts");

export async function GET(_req: Request, ctx: RouteContext<"/quotes/[id]/card">) {
  const { id } = await ctx.params;
  const store = await getStore();
  const quote = await store.getQuote(id);
  if (!quote || quote.visibility !== "public") return new Response("Not found", { status: 404 });

  const [serif, serifItalic, mono, hand] = await Promise.all(
    ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Italic.ttf", "DMMono-Regular.ttf", "Caveat-Medium.ttf"].map((f) => readFile(path.join(fontDir, f))),
  );
  const p = PALETTES[hash(quote.id) % PALETTES.length];
  const len = quote.body.length;
  const size = len < 60 ? 92 : len < 140 ? 72 : len < 260 ? 56 : len < 420 ? 44 : 36;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: p.bg, padding: 72, fontFamily: "Serif", color: p.ink, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: `linear-gradient(225deg, ${p.bg === "#292C27" ? "#1c1e1a" : "#F5F0E7"} 50%, ${p.panel} 50%)` }} />
        <div style={{ display: "flex", fontFamily: "Mono", fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: p.accent }}>a passage worth keeping</div>
        <div style={{ display: "flex", fontSize: 220, lineHeight: 0.8, color: p.accent, marginTop: 40, fontFamily: "Serif" }}>“</div>
        <div style={{ display: "flex", flex: 1, fontFamily: "SerifItalic", fontSize: size, lineHeight: 1.18, marginTop: -20 }}>{quote.body}</div>
        {quote.commentary && <div style={{ display: "flex", fontFamily: "Hand", fontSize: 44, color: p.accent, marginTop: 24 }}>{quote.commentary.slice(0, 120)}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid ${p.ink}`, paddingTop: 28, marginTop: 36 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 44 }}>{quote.book.title.slice(0, 60)}</div>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 24, letterSpacing: 2, textTransform: "uppercase", marginTop: 8 }}>{authorLine(quote.book.authors)}{quote.page ? ` · p. ${quote.page}` : ""}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 52 }}>dogear<span style={{ color: p.accent }}>.</span></div>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 20 }}>@{quote.author.username}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Serif", data: serif, style: "normal" },
        { name: "SerifItalic", data: serifItalic, style: "normal" },
        { name: "Mono", data: mono, style: "normal" },
        { name: "Hand", data: hand, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
