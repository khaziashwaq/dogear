import type { NextRequest } from "next/server";
import { getStore } from "@/lib/auth";
import { searchCatalogue, searchEverywhere } from "@/lib/book-search";

/**
 * Book picker search, as a GET route rather than a server action: Next runs a page's server actions one
 * at a time, so every keystroke's instant catalogue lookup used to queue behind the previous (slow) Open
 * Library search, and so did "Add to Want to read". Plain fetches run in parallel and can be aborted.
 *
 * ?scope=catalogue → our catalogue only (milliseconds); otherwise catalogue + Open Library.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 120);
  if (query.length < 2) return Response.json([]);
  const store = await getStore();
  // Signed-in readers only: this isn't a public Open Library proxy.
  if (!store.viewerId) return Response.json({ error: "Sign in to search." }, { status: 401 });
  const books = params.get("scope") === "catalogue" ? await searchCatalogue(store, query) : await searchEverywhere(store, query);
  return Response.json(books, { headers: { "Cache-Control": "private, max-age=60" } });
}
