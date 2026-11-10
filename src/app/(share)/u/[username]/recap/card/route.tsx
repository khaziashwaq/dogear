import { ImageResponse } from "next/og";
import { getStore } from "@/lib/auth";
import { CardBrand, CardCover, CardFrame, cardFonts, cardHeaders, cardParams } from "@/lib/og";
import { lookupProfile } from "@/lib/profile-lookup";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/*
  Share image for a Reading Yearbook (?year=) or a month (?year=&month=).
  Rendered as whoever fetches it, so a public link only ever shows public shelves.
*/
export async function GET(req: Request, ctx: RouteContext<"/u/[username]/recap/card">) {
  const { username } = await ctx.params;
  const url = new URL(req.url);
  const profile = await lookupProfile(username);
  if (!profile?.username) return new Response("Not found", { status: 404 });
  const now = new Date();
  const year = Math.min(now.getFullYear(), Math.max(2000, Number(url.searchParams.get("year")) || now.getFullYear()));
  const m = Number(url.searchParams.get("month"));
  const month = m >= 1 && m <= 12 ? m : null;
  const r = await (await getStore()).readingRecap(profile.id, year, month);

  const { template, format, size, theme } = cardParams(url);
  const [W, H] = size;
  const og = format === "og";
  const covers = [...new Map(r.timeline.map((t) => [t.id, t])).values()].slice(0, og ? 5 : format === "story" ? 12 : 9);
  const who = profile.displayName || `@${profile.username}`;
  const label = month ? `${MONTHS[month - 1]} ${year}` : `${year}`;
  const facts = [
    r.topAuthor && { k: "most-read author", v: r.topAuthor.name },
    r.topGenre && { k: "kept returning to", v: r.topGenre.name },
    !month && r.busiestMonth && { k: "busiest month", v: MONTHS[r.busiestMonth.month - 1] },
    // The card fonts have no ★ glyph, so ratings are written out.
    r.averageRating && { k: "average rating", v: `${r.averageRating} / 5` },
  ].filter(Boolean).slice(0, og ? 2 : 4) as { k: string; v: string }[];

  const card = (
    <CardFrame template={template} format={format} width={W}>
      <div style={{ display: "flex", fontFamily: template === "scrapbook" ? "Hand" : "SerifItalic", fontSize: og ? 24 : 34, color: theme.accent }}>
        {who}&rsquo;s {month ? "month" : "year"} in books
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 8 }}>
        <div style={{ display: "flex", fontSize: og ? 120 : 200, lineHeight: 0.9, color: theme.ink }}>{r.completions}</div>
        <div style={{ display: "flex", flexDirection: "column", paddingBottom: og ? 10 : 22 }}>
          <div style={{ display: "flex", fontSize: og ? 34 : 54, color: theme.ink }}>{r.completions === 1 ? "book" : "books"}</div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: og ? 18 : 24, color: theme.soft }}>
            {label}
            {r.rereads ? ` · ${r.rereads} re-read${r.rereads > 1 ? "s" : ""}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: og ? 16 : 26, flex: 1, alignContent: "center", marginTop: og ? 18 : 36, marginBottom: og ? 18 : 30 }}>
        {covers.map((c, i) => (
          <div key={c.id} style={{ display: "flex", transform: `rotate(${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg)` }}>
            <CardCover title={c.title} coverUrl={c.coverUrl} w={og ? 100 : format === "story" ? 190 : 156} template={template} />
          </div>
        ))}
      </div>

      {r.favouriteBook && !og && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 10, marginBottom: 26 }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 22, color: theme.soft }}>THE ONE</div>
          <div style={{ display: "flex", fontSize: 50, lineHeight: 1.05, color: theme.ink }}>{r.favouriteBook.title.slice(0, 60)}</div>
        </div>
      )}

      {facts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: og ? "8px 30px" : "18px 48px", marginBottom: og ? 14 : 24 }}>
          {facts.map((f) => (
            <div key={f.k} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "Mono", fontSize: og ? 14 : 18, color: theme.soft }}>{f.k.toUpperCase()}</div>
              <div style={{ display: "flex", fontFamily: "SerifItalic", fontSize: og ? 26 : 36, color: theme.ink }}>{f.v.slice(0, 26)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `${template === "scrapbook" ? "3px dashed" : "2px solid"} ${theme.rule}`, paddingTop: 20 }}>
        <div style={{ display: "flex", fontFamily: "Mono", fontSize: og ? 16 : 22, color: theme.soft }}>{month ? "MONTH IN BOOKS" : "READING YEARBOOK"}</div>
        <CardBrand template={template} format={format} username={profile.username} />
      </div>
    </CardFrame>
  );

  return new ImageResponse(card, { width: W, height: H, fonts: await cardFonts(), headers: cardHeaders });
}
