import type { Metadata } from "next";
import { ListForm } from "@/components/list/list-form";
import { getStore, requireViewer } from "@/lib/auth";
import { lookupBook } from "@/lib/book-lookup";

export const metadata: Metadata = { title: "New list" };

export default async function NewListPage({ searchParams }: PageProps<"/lists/new">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/lists/new");
  const store = await getStore();
  const [book, shelf] = await Promise.all([typeof sp.book === "string" ? lookupBook(sp.book) : null, store.getShelf(viewer.id, { sort: "recent" })]);
  return (
    <div className="mx-auto max-w-5xl">
      <p className="meta text-burgundy">curate</p>
      <h1 className="mb-8 mt-1 text-5xl">Make a list</h1>
      <ListForm initialBooks={book ? [book] : []} suggestions={shelf.slice(0, 10).map((s) => s.book)} />
    </div>
  );
}
