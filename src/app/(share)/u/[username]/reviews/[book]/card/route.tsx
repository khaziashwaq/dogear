import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { jacketColours } from "@/lib/jacket";
import { lookupReview } from "@/lib/review-lookup";
import { SHARE_TEMPLATES, type ShareTemplate } from "@/lib/share-cards";
import { authorLine, excerpt } from "@/lib/utils";

/*
  Share cards for a review, composed (not screenshotted) with next/og.

  ?template = minimal | vintage | scrapbook | dark
  ?format   = portrait (1080×1350, Instagram/WhatsApp) | og (1200×630, link previews)
  ?r        = a specific review id, for re-reads
*/

const TEMPLATES: readonly string[] = SHARE_TEMPLATES.map((t) => t.key);
type Template = ShareTemplate;

const THEME: Record<Template, { bg: string; paper: string; ink: string; soft: string; accent: string; star: string; rule: string }> = {
  minimal: { bg: "#F5F0E7", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", star: "#743F48", rule: "#292C27" },
  vintage: { bg: "#E9D9A8", paper: "#F3E8C6", ink: "#3B2A1E", soft: "#6B5640", accent: "#743F48", star: "#743F48", rule: "#743F48" },
  scrapbook: { bg: "#A6AC91", paper: "#FBF8F2", ink: "#292C27", soft: "#55594F", accent: "#743F48", star: "#743F48", rule: "#D9A9A0" },
  dark: { bg: "#1F2420", paper: "#292C27", ink: "#F0E6CF", soft: "#BDB39A", accent: "#E9D9A8", star: "#E9D9A8", rule: "#E9D9A8" },
};

const fontDir = path.join(process.cwd(), "src/assets/fonts");

/** The cover as a data URI (satori can't follow every redirect reliably), or null to typeset a jacket. */
async function coverData(url: string | null, origin: string): Promise<string | null> {
  if (!url) return null;
  try {
    const abs = new URL(url, origin).toString();
    const res = await fetch(abs, { signal: AbortSignal.timeout(4500), redirect: "follow" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1200) return null; // Open Library's 1×1 "no cover" pixel
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Star({ fill, color, size }: { fill: 0 | 0.5 | 1; color: string; size: number }) {
  const d = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z";
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", top: 0, left: 0 }}>
        <path d={d} fill="none" stroke={color} strokeWidth={1.4} />
      </svg>
      {fill > 0 && (
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: size * fill, height: size, overflow: "hidden" }}>
          <svg width={size} height={size} viewBox="0 0 24 24">
            <path d={d} fill={color} />
          </svg>
        </div>
      )}
    </div>
  );
}

function Stars({ value, color, size }: { value: number | null; color: string; size: number }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: size * 0.18 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={color} fill={value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0} />
      ))}
    </div>
  );
}

export async function GET(req: Request, ctx: RouteContext<"/u/[username]/reviews/[book]/card">) {
  const { username, book: bookSlug } = await ctx.params;
  const url = new URL(req.url);
  const found = await lookupReview(username, bookSlug, url.searchParams.get("r"));
  // Only public reviews get an image anyone can fetch.
  if (!found || found.review.visibility !== "public") return new Response("Not found", { status: 404 });
  const { review } = found;

  const template: Template = TEMPLATES.includes(url.searchParams.get("template") ?? "") ? (url.searchParams.get("template") as Template) : "minimal";
  const og = url.searchParams.get("format") === "og";
  const W = og ? 1200 : 1080;
  const H = og ? 630 : 1350;
  const t = THEME[template];

  const [fonts, cover] = await Promise.all([
    Promise.all(["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Italic.ttf", "DMMono-Regular.ttf", "Caveat-Medium.ttf"].map((f) => readFile(path.join(fontDir, f)))),
    coverData(review.book.coverUrl, url.origin),
  ]);
  const [serif, serifItalic, mono, hand] = fonts;

  const book = review.book;
  const who = review.author.displayName || review.author.username || "a reader";
  const date = new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const body = review.containsSpoilers
    ? "This review contains spoilers — read it on dogear."
    : excerpt(review.body, og ? 190 : template === "scrapbook" ? 300 : 430);
  const bodySize = og ? (body.length > 150 ? 26 : 30) : body.length > 340 ? 34 : body.length > 220 ? 38 : 44;
  const coverW = og ? 250 : template === "scrapbook" ? 330 : 300;
  const coverH = Math.round(coverW * 1.5);
  const jacket = jacketColours(book.title, book.authors);

  const Cover = (
    <div
      style={{
        display: "flex",
        width: coverW,
        height: coverH,
        flexShrink: 0,
        boxShadow: template === "dark" ? "0 24px 50px rgba(0,0,0,0.55)" : "10px 16px 0 rgba(41,44,39,0.14), 0 26px 40px -18px rgba(41,44,39,0.55)",
        background: jacket.bg,
        color: jacket.fg,
        ...(template === "scrapbook" ? { transform: "rotate(-3deg)" } : {}),
      }}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} width={coverW} height={coverH} alt="" style={{ objectFit: "cover", width: coverW, height: coverH }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 26, width: "100%" }}>
          <div style={{ display: "flex", fontSize: 40, lineHeight: 1.05 }}>{book.title.slice(0, 70)}</div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 16, letterSpacing: 2 }}>{authorLine(book.authors).toUpperCase()}</div>
        </div>
      )}
    </div>
  );

  const Brand = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ display: "flex", fontSize: og ? 40 : 52, color: t.ink }}>
        dogear<span style={{ color: t.accent }}>.</span>
      </div>
      <div style={{ display: "flex", fontFamily: "Mono", fontSize: og ? 16 : 20, color: t.soft }}>@{review.author.username}</div>
    </div>
  );

  const Byline = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontFamily: template === "scrapbook" ? "Hand" : "SerifItalic", fontSize: og ? 26 : template === "scrapbook" ? 40 : 30, color: t.accent }}>
        {template === "scrapbook" ? `reviewed by ${who}` : `Reviewed by ${who}`}
      </div>
      <div style={{ display: "flex", fontFamily: "Mono", fontSize: og ? 15 : 19, color: t.soft, marginTop: 6, letterSpacing: 1 }}>{date}</div>
    </div>
  );

  const Title = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: og ? 50 : book.title.length > 34 ? 58 : 72, lineHeight: 1, color: t.ink }}>{book.title.slice(0, 80)}</div>
      <div style={{ display: "flex", fontFamily: "SerifItalic", fontSize: og ? 26 : 34, color: t.soft, marginTop: 12 }}>{authorLine(book.authors)}</div>
      <div style={{ display: "flex", marginTop: og ? 18 : 26 }}>
        <Stars value={review.rating} color={t.star} size={og ? 34 : 46} />
      </div>
    </div>
  );

  const Body = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: og ? 18 : 36 }}>
      {review.title && !review.containsSpoilers && (
        <div style={{ display: "flex", fontFamily: "SerifItalic", fontSize: og ? 30 : 46, lineHeight: 1.1, color: t.ink, marginBottom: 16 }}>{review.title.slice(0, 90)}</div>
      )}
      <div style={{ display: "flex", fontFamily: template === "scrapbook" ? "Hand" : "Serif", fontSize: template === "scrapbook" ? bodySize * 1.2 : bodySize, lineHeight: template === "scrapbook" ? 1.15 : 1.32, color: t.ink }}>{body}</div>
    </div>
  );

  let card;
  if (og) {
    // Link preview: cover left, words right.
    card = (
      <div style={{ display: "flex", width: "100%", height: "100%", background: t.bg, padding: 56, gap: 56, fontFamily: "Serif" }}>
        {Cover}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {Byline}
          <div style={{ display: "flex", marginTop: 18 }}>{Title}</div>
          {Body}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>{Brand}</div>
        </div>
      </div>
    );
  } else if (template === "scrapbook") {
    card = (
      <div style={{ display: "flex", width: "100%", height: "100%", background: t.bg, padding: 60, fontFamily: "Serif", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%", background: t.paper, padding: 56, transform: "rotate(1deg)", boxShadow: "0 30px 50px -24px rgba(41,44,39,0.6)" }}>
          <div style={{ display: "flex", gap: 44, alignItems: "flex-start" }}>
            <div style={{ display: "flex", position: "relative" }}>
              {Cover}
              <div style={{ display: "flex", position: "absolute", top: -20, left: 90, width: 150, height: 40, background: "rgba(233,217,168,0.85)", transform: "rotate(-6deg)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: 16 }}>
              {Byline}
              <div style={{ display: "flex", marginTop: 24 }}>{Title}</div>
            </div>
          </div>
          {Body}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `3px dashed ${t.rule}`, paddingTop: 24 }}>
            <div style={{ display: "flex", fontFamily: "Hand", fontSize: 36, color: t.accent }}>from my reading journal</div>
            {Brand}
          </div>
        </div>
        <div style={{ display: "flex", position: "absolute", top: 40, right: 120, width: 170, height: 44, background: "rgba(217,169,160,0.85)", transform: "rotate(8deg)" }} />
      </div>
    );
  } else {
    // minimal · vintage · dark share one editorial layout, dressed differently.
    const framed = template === "vintage";
    card = (
      <div style={{ display: "flex", width: "100%", height: "100%", background: t.bg, padding: framed ? 40 : 72, fontFamily: "Serif" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: framed ? 48 : 0,
            ...(framed ? { border: `3px solid ${t.rule}` } : {}),
            background: framed ? t.paper : "transparent",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {Byline}
            {template === "dark" && <div style={{ display: "flex", fontFamily: "SerifItalic", fontSize: 30, color: t.accent }}>marginalia</div>}
          </div>
          <div style={{ display: "flex", gap: 48, marginTop: 40, alignItems: "flex-end" }}>
            {Cover}
            <div style={{ display: "flex", flex: 1 }}>{Title}</div>
          </div>
          {Body}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid ${t.rule}`, paddingTop: 24 }}>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 18, letterSpacing: 2, color: t.soft }}>A REVIEW ON DOGEAR</div>
            {Brand}
          </div>
        </div>
      </div>
    );
  }

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
