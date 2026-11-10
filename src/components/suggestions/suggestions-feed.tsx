import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getStore } from "@/lib/auth";
import { loadSuggestions } from "@/lib/suggestions/service";
import { liveSources } from "@/lib/suggestions/sources";
import { SuggestionList } from "./suggestion-list";

/**
 * Suggestions for the signed-in reader: rebuilt first if their shelves changed since last time,
 * then the saved list. `compact` is the short version on Discover.
 */
export async function SuggestionsFeed({ compact = false }: { compact?: boolean }) {
  const store = await getStore();
  const view = await loadSuggestions(store, liveSources(store), compact ? 3 : 12);

  switch (view.state) {
    case "empty-library":
      return (
        <EmptyState
          title="Suggestions start with your shelves"
          body="Add a few books you've read, are reading or want to read. Their authors, genres and themes show Dogear what to look for."
          action={<ButtonLink href="/search">Find a book</ButtonLink>}
        />
      );
    case "no-signal":
      return (
        <EmptyState
          title="Not enough to go on yet"
          body="The books on your shelves don't have genres or subjects listed yet. Add a few more, or pick favourite genres in settings, and suggestions will follow."
          action={<ButtonLink href="/settings">Choose favourite genres</ButtonLink>}
        />
      );
    case "unavailable":
      return (
        <EmptyState
          title="Couldn't look for books just now"
          body="Open Library, where most suggestions come from, didn't answer. Your shelves are fine. Try this page again in a minute."
        />
      );
    case "exhausted":
      return (
        <EmptyState
          title="No new suggestions right now"
          body="You've seen everything that matches your shelves so far. Each book you add gives Dogear more to go on."
          action={<ButtonLink href="/discover">Browse Discover</ButtonLink>}
        />
      );
    case "ready":
      return (
        <div>
          {view.updating && <p className="meta mb-3 normal-case tracking-normal">Still catching up with your latest books. These may change shortly.</p>}
          <SuggestionList initial={view.page} compact={compact} />
          {compact && (
            <Link href="/discover/for-you" className="link-underline mt-4 inline-block text-sm text-burgundy">
              See all your suggestions
            </Link>
          )}
        </div>
      );
  }
}

export function SuggestionsSkeleton({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className="divide-y divide-line border-y border-line" aria-busy aria-label="Finding books for you">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={compact ? "flex gap-5 py-5" : "flex gap-8 py-8"}>
          <Skeleton className={compact ? "h-[6.5rem] w-[4.5rem]" : "h-40 w-28"} />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-12 w-full max-w-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
