import { Lock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/feed/comment-thread";
import { PostActions } from "@/components/feed/post-actions";
import { FollowListButton, ListBooks } from "@/components/list/list-books";
import { ListCover } from "@/components/list/list-cover";
import { Avatar } from "@/components/profile/avatar";
import { buttonClass } from "@/components/ui/button";
import { ShareButton } from "@/components/ui/share-button";
import { getStore, getViewer } from "@/lib/auth";
import { formatDate, plural } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/lists/[id]">): Promise<Metadata> {
  const list = await (await getStore()).getList((await params).id);
  return list ? { title: list.title, description: list.description ?? undefined } : { title: "List not found" };
}

export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const list = await store.getList((await params).id);
  if (!list) notFound();
  const own = viewer?.id === list.userId;
  const [post, comments] = list.postId ? await Promise.all([store.getPost(list.postId), store.listComments(list.postId)]) : [null, []];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="paper overflow-hidden">
        <ListCover style={list.coverStyle} books={list.preview} imageUrl={list.coverImageUrl} size="lg" />
        <div className="relative p-6 sm:p-8">
          <div className="tape -top-3 right-10 rotate-3" aria-hidden />
          <p className="meta flex flex-wrap items-center gap-3 text-burgundy">
            <span>{list.isRanked ? "a ranked list" : "a list"}</span>
            <span>{plural(list.bookCount, "book")}</span>
            {list.visibility !== "public" && <span className="inline-flex items-center gap-1"><Lock className="size-3" /> {list.visibility === "private" ? "only you" : "followers"}</span>}
            <span className="inline-flex items-center gap-1"><Users className="size-3" /> {list.followersCount}</span>
          </p>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">{list.title}</h1>
          {list.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-[1.02rem] leading-relaxed text-ink/90">{list.description}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <Link href={`/u/${list.owner.username}`} className="flex items-center gap-2 text-sm">
              <Avatar profile={list.owner} size="sm" />
              <span>curated by <span className="font-medium">{list.owner.displayName}</span></span>
              <span className="meta normal-case tracking-normal">· updated {formatDate(list.updatedAt)}</span>
            </Link>
            <div className="flex flex-wrap gap-2">
              {!own && <FollowListButton listId={list.id} initial={list.viewerFollows} count={list.followersCount} />}
              {list.visibility === "public" && <ShareButton path={`/lists/${list.id}`} title={list.title} />}
              {own && <Link href={`/lists/${list.id}/edit`} className={buttonClass("paper", "md")}>Edit details</Link>}
            </div>
          </div>
          {post && <div className="mt-4 border-t border-line pt-2"><PostActions post={post} /></div>}
        </div>
      </header>

      <section className="mt-10" aria-label="Books in this list">
        {own && <p className="meta mb-3">Drag to reorder, or use the arrows. Add a note to say why each book belongs.</p>}
        <ListBooks listId={list.id} initial={list.books} ranked={list.isRanked} editable={own} />
      </section>

      {list.postId && <div className="mt-14"><CommentThread postId={list.postId} postOwnerId={list.userId} initial={comments} /></div>}
    </div>
  );
}
