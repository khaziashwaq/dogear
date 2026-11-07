import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/feed/comment-thread";
import { PostCard } from "@/components/feed/post-card";
import { getStore } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/post/[id]">): Promise<Metadata> {
  const store = await getStore();
  const post = await store.getPost((await params).id);
  if (!post) return { title: "Post not found" };
  const what = post.review ? `review of ${post.review.book.title}` : post.quote ? `quote from ${post.quote.book.title}` : post.list ? `list “${post.list.title}”` : "post";
  return { title: `${post.author.displayName}'s ${what}` };
}

export default async function PostPage({ params }: PageProps<"/post/[id]">) {
  const store = await getStore();
  const { id } = await params;
  const post = await store.getPost(id);
  if (!post) notFound();
  const target = post.kind === "repost" && post.repostOf ? post.repostOf : post;
  const comments = await store.listComments(target.id);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/activity" className="meta hover:text-ink">← back to activity</Link>
      <div className="mt-4"><PostCard post={target} full /></div>
      {target.list && (
        <Link href={`/lists/${target.list.id}`} className="meta mt-3 inline-block text-burgundy hover:text-ink">Open the full list →</Link>
      )}
      {target.quote && (
        <Link href={`/quotes/${target.quote.id}`} className="meta mt-3 inline-block text-burgundy hover:text-ink">Get a shareable card →</Link>
      )}
      <div className="mt-10"><CommentThread postId={target.id} postOwnerId={target.userId} initial={comments} /></div>
    </div>
  );
}
