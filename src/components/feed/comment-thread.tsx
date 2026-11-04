"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction } from "@/app/actions/social";
import { Avatar } from "@/components/profile/avatar";
import { useViewer } from "@/components/providers/viewer";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Comment } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

function CommentForm({ postId, parentId, onDone, autoFocus, placeholder }: { postId: string; parentId: string | null; onDone: (c: Comment) => void; autoFocus?: boolean; placeholder: string }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const res = await addCommentAction(postId, body, parentId);
          if (!res.ok) return toast(res.error, "error");
          setBody("");
          onDone(res.data);
        });
      }}
      className="flex items-start gap-2"
    >
      <label className="sr-only" htmlFor={`c-${parentId ?? "root"}`}>{placeholder}</label>
      <textarea id={`c-${parentId ?? "root"}`} className="field min-h-11 resize-y text-sm" rows={parentId ? 1 : 2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={placeholder} autoFocus={autoFocus} />
      <Button type="submit" size="sm" disabled={pending || !body.trim()} className="mt-1">{pending ? "…" : "Post"}</Button>
    </form>
  );
}

export function CommentThread({ postId, postOwnerId, initial }: { postId: string; postOwnerId: string; initial: Comment[] }) {
  const { viewer } = useViewer();
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const remove = (c: Comment) => {
    if (!confirm("Delete this comment?")) return;
    start(async () => {
      const res = await deleteCommentAction(c.id, postId);
      if (!res.ok) return toast(res.error, "error");
      setComments((list) => list.filter((x) => x.id !== c.id).map((x) => ({ ...x, replies: x.replies.filter((r) => r.id !== c.id) })));
      router.refresh();
    });
  };

  const Item = ({ c, isReply }: { c: Comment; isReply?: boolean }) => (
    <li className={cn("flex gap-3", isReply && "mt-4")}>
      <Link href={`/u/${c.author.username}`}><Avatar profile={c.author} size={isReply ? "xs" : "sm"} /></Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link href={`/u/${c.author.username}`} className="font-medium hover:text-burgundy">{c.author.displayName}</Link>
          <span className="meta ml-2 normal-case tracking-normal">{timeAgo(c.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-line text-[0.95rem] leading-relaxed">{c.body}</p>
        <div className="mt-1 flex gap-3">
          {viewer && !isReply && <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="meta hover:text-ink">reply</button>}
          {viewer && (viewer.id === c.userId || viewer.id === postOwnerId) && <button type="button" onClick={() => remove(c)} className="meta hover:text-burgundy">delete</button>}
        </div>
        {!isReply && (c.replies.length > 0 || replyTo === c.id) && (
          <ul className="border-l border-line pl-4">
            {c.replies.map((r) => <Item key={r.id} c={r} isReply />)}
            {replyTo === c.id && (
              <li className="mt-3">
                <CommentForm
                  postId={postId}
                  parentId={c.id}
                  autoFocus
                  placeholder={`Reply to ${c.author.displayName.split(" ")[0]}…`}
                  onDone={(n) => {
                    setComments((list) => list.map((x) => (x.id === c.id ? { ...x, replies: [...x.replies, n] } : x)));
                    setReplyTo(null);
                  }}
                />
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );

  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  return (
    <section id="comments" aria-labelledby="comments-h" className="scroll-mt-24">
      <h2 id="comments-h" className="text-2xl">{count ? `${count} ${count === 1 ? "comment" : "comments"}` : "Comments"}</h2>
      <div className="mt-4">
        {viewer ? (
          <CommentForm postId={postId} parentId={null} placeholder="Add to the margins…" onDone={(c) => setComments((l) => [...l, c])} />
        ) : (
          <Link href={`/login?next=/post/${postId}`} className={buttonClass("paper", "md")}>Sign in to comment</Link>
        )}
      </div>
      {comments.length === 0 ? (
        <p className="hand mt-6 text-2xl text-ink-faint">no comments yet — start the conversation</p>
      ) : (
        <ul className="mt-6 space-y-6">{comments.map((c) => <Item key={c.id} c={c} />)}</ul>
      )}
    </section>
  );
}
