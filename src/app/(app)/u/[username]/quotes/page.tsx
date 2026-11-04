import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteCard } from "@/components/quote/quote-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";

export default async function ProfileQuotes({ params }: PageProps<"/u/[username]/quotes">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const quotes = await store.listQuotesByUser(profile.id);
  const own = viewer?.id === profile.id;
  if (quotes.length === 0)
    return <EmptyState title="No quotes saved" body="The sentences you'd tattoo, if you were braver." action={own ? <ButtonLink href="/quotes/new">Save a quote</ButtonLink> : undefined} />;
  return (
    <div className="masonry columns-1 sm:columns-2 lg:columns-3">
      {quotes.map((q) => <Link key={q.id} href={`/quotes/${q.id}`} className="block"><QuoteCard quote={q} linkBook={false} /></Link>)}
    </div>
  );
}
