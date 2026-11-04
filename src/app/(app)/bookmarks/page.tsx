import type { Metadata } from "next";
import { loadBookmarksAction } from "@/app/actions/social";
import { FeedList } from "@/components/feed/feed-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  await requireViewer("/bookmarks");
  const page = await (await getStore()).listBookmarks(null);
  const load = async (cursor: string) => {
    "use server";
    return loadBookmarksAction(cursor);
  };
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-5xl leading-none">Bookmarks<span className="text-burgundy">.</span></h1>
      <p className="hand mt-1 text-2xl text-ink-soft">things you folded a corner on — only you can see these</p>
      <div className="mt-8">
        <FeedList initial={page} load={load} empty={<EmptyState title="Nothing saved yet" body="Tap the bookmark on any review, quote or list to keep it here." action={<ButtonLink href="/discover">Go exploring</ButtonLink>} />} />
      </div>
    </div>
  );
}
