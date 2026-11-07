import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/quote/quote-form";
import { getStore, requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit highlight" };

export default async function EditQuotePage({ params }: PageProps<"/quotes/[id]/edit">) {
  const viewer = await requireViewer();
  const store = await getStore();
  const [quote, tags] = await Promise.all([store.getQuote((await params).id), store.marginaliaTags(12)]);
  if (!quote || quote.userId !== viewer.id) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-4xl sm:text-5xl">{quote.isDraft ? "Finish your highlight" : "Edit highlight"}</h1>
      <QuoteForm initialBook={quote.book} existing={quote} suggestions={[]} tagSuggestions={tags.map((t) => t.tag)} />
    </div>
  );
}
