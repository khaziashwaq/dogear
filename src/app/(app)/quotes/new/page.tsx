import type { Metadata } from "next";
import { QuoteForm } from "@/components/quote/quote-form";
import { getStore, requireViewer } from "@/lib/auth";
import { lookupBook } from "@/lib/book-lookup";

export const metadata: Metadata = { title: "Save a quote" };

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/quotes/new");
  const store = await getStore();
  const [book, shelf] = await Promise.all([typeof sp.book === "string" ? lookupBook(sp.book) : null, store.getShelf(viewer.id, { sort: "recent" })]);
  return (
    <div className="mx-auto max-w-5xl">
      <p className="meta text-burgundy">underlined</p>
      <h1 className="mb-8 mt-1 text-5xl">Save a passage</h1>
      <QuoteForm initialBook={book} suggestions={shelf.slice(0, 8).map((s) => s.book)} />
    </div>
  );
}
