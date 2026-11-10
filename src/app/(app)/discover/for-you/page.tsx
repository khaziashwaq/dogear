import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SuggestionsFeed, SuggestionsSkeleton } from "@/components/suggestions/suggestions-feed";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Suggested for you" };

export default async function SuggestionsPage() {
  await requireViewer("/discover/for-you");
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link href="/discover" className="meta hover:text-ink">← all of discover</Link>
        <h1 className="mt-2 text-5xl leading-none sm:text-6xl">Suggested for you<span className="text-burgundy">.</span></h1>
        <p className="mt-3 max-w-xl text-ink-soft">
          Picked from the authors, genres and themes on your shelves. Books you&rsquo;ve finished and loved count most.
          The list changes as your shelves do.
        </p>
      </header>
      <Suspense fallback={<SuggestionsSkeleton count={4} />}>
        <SuggestionsFeed />
      </Suspense>
    </div>
  );
}
