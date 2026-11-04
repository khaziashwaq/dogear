import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/quote/quote-form";
import { getStore, requireViewer } from "@/lib/auth";

export default async function EditQuotePage({ params }: PageProps<"/quotes/[id]/edit">) {
  const viewer = await requireViewer();
  const quote = await (await getStore()).getQuote((await params).id);
  if (!quote || quote.userId !== viewer.id) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-5xl">Edit quote</h1>
      <QuoteForm initialBook={quote.book} existing={quote} suggestions={[]} />
    </div>
  );
}
