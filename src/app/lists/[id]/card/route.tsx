import { ImageResponse } from "next/og";
import { getStore } from "@/lib/auth";
import { CardBrand, CardCover, CardFrame, cardFonts, cardHeaders, cardParams } from "@/lib/og";
import { excerpt } from "@/lib/utils";

/*
  Share image for a pinboard (list): the books pinned up like a moodboard.
  ?template = minimal | vintage | scrapbook | dark    ?format = portrait | story | og
*/
export async function GET(req: Request, ctx: RouteContext<"/lists/[id]/card">) {
  const { id } = await ctx.params;
  const list = await (await getStore()).getList(id);
  // Only public lists get an image anyone can fetch.
  if (!list || list.visibility !== "public") return new Response("Not found", { status: 404 });

  const { template, format, size, theme } = cardParams(new URL(req.url));
  const [W, H] = size;
  const books = list.books.slice(0, format === "story" ? 9 : 6);
  const cols = format === "og" ? 6 : 3;
  const coverW = format === "og" ? 120 : format === "story" ? 230 : 220;
  const tilt = [-2.5, 1.5, -1, 2, -1.5, 1, -2, 1.5, -0.5];
  const who = list.owner.displayName || `@${list.owner.username}`;

  const card = (
    <CardFrame template={template} format={format} width={W}>
      <div style={{ display: "flex", fontFamily: template === "scrapbook" ? "Hand" : "SerifItalic", fontSize: format === "og" ? 24 : 32, color: theme.accent }}>
        {list.isRanked ? "a ranked list by " : "a list by "}
        {who}
      </div>
      <div style={{ display: "flex", fontSize: format === "og" ? 48 : list.title.length > 40 ? 64 : 84, lineHeight: 1.05, color: theme.ink, marginTop: 10 }}>
        {list.title.slice(0, 90)}
      </div>
      {list.description && format !== "og" && (
        <div style={{ display: "flex", fontFamily: "Hand", fontSize: 38, lineHeight: 1.15, color: theme.soft, marginTop: 16 }}>{excerpt(list.description, 120)}</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: format === "og" ? 22 : 36, flex: 1, alignContent: "center", justifyContent: "center", marginTop: 24, marginBottom: 24 }}>
        {books.map((b, i) => (
          <div key={b.bookId} style={{ display: "flex", transform: `rotate(${tilt[i % tilt.length]}deg)`, width: `${100 / cols - 6}%`, justifyContent: "center" }}>
            <CardCover title={b.book.title} coverUrl={b.book.coverUrl} w={coverW} template={template} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `${template === "scrapbook" ? "3px dashed" : "2px solid"} ${theme.rule}`, paddingTop: 20 }}>
        <div style={{ display: "flex", fontFamily: "Mono", fontSize: format === "og" ? 18 : 24, color: theme.soft }}>
          {list.bookCount} {list.bookCount === 1 ? "book" : "books"}
        </div>
        <CardBrand template={template} format={format} username={list.owner.username} />
      </div>
    </CardFrame>
  );

  return new ImageResponse(card, { width: W, height: H, fonts: await cardFonts(), headers: cardHeaders });
}
