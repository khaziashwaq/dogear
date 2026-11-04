import type { Metadata } from "next";
import { ReviewForm } from "@/components/review/review-form";
import { getStore, requireViewer } from "@/lib/auth";
import { lookupBook } from "@/lib/book-lookup";

export const metadata: Metadata = { title: "Write a review" };

export default async function NewReviewPage({ searchParams }: PageProps<"/review/new">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/review/new");
  const store = await getStore();
  const book = typeof sp.book === "string" ? await lookupBook(sp.book) : null;
  const [recent, ub] = await Promise.all([store.getShelf(viewer.id, { sort: "recent" }), book?.id ? store.getUserBook(book.id) : null]);
  return (
    <div className="mx-auto max-w-2xl">
      <p className="meta text-burgundy">the margins</p>
      <h1 className="mb-8 mt-1 text-5xl">Write a review</h1>
      <div className="paper dogear p-5 sm:p-8">
        <ReviewForm initialBook={book} suggestions={recent.slice(0, 8).map((r) => r.book)} initialRating={ub?.rating ?? null} />
      </div>
    </div>
  );
}
