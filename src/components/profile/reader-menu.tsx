"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setBlockedAction, setMutedAction } from "@/app/actions/social";
import { ReportDialog } from "@/components/safety/report-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { Relationship } from "@/lib/types";

/** ⋯ on someone else's profile: mute, block and report. */
export function ReaderMenu({ userId, name, initial }: { userId: string; name: string; initial: Relationship }) {
  const [rel, setRel] = useState(initial);
  const [open, setOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const first = name.split(" ")[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const mute = () =>
    start(async () => {
      setOpen(false);
      const res = await setMutedAction(userId, !rel.muted);
      if (!res.ok) return toast(res.error, "error");
      setRel((r) => ({ ...r, muted: !r.muted }));
      toast(rel.muted ? `${first} is back in your feeds` : `Muted. ${first}'s posts won't show in your feeds.`);
      router.refresh();
    });

  const block = (on: boolean) =>
    start(async () => {
      setConfirmBlock(false);
      setOpen(false);
      const res = await setBlockedAction(userId, on);
      if (!res.ok) return toast(res.error, "error");
      setRel((r) => ({ ...r, blocked: on, following: on ? false : r.following }));
      toast(on ? `Blocked ${first}` : `Unblocked ${first}`);
      router.refresh();
    });

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More options for ${name}`}
        className="grid size-10 place-items-center border border-line-strong bg-card text-ink-soft hover:border-ink hover:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-30 w-52 border border-line-strong bg-card py-1 text-sm shadow-[var(--shadow-lift)]">
          {!rel.blocked && (
            <button role="menuitem" type="button" disabled={pending} onClick={mute} className="block w-full px-4 py-2 text-left hover:bg-paper-deep">
              {rel.muted ? `Unmute ${first}` : `Mute ${first}`}
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => (rel.blocked ? block(false) : (setOpen(false), setConfirmBlock(true)))}
            className="block w-full px-4 py-2 text-left hover:bg-paper-deep"
          >
            {rel.blocked ? `Unblock ${first}` : `Block ${first}`}
          </button>
          <button role="menuitem" type="button" onClick={() => (setOpen(false), setReporting(true))} className="block w-full px-4 py-2 text-left text-burgundy hover:bg-paper-deep">
            Report profile
          </button>
        </div>
      )}

      <Dialog open={confirmBlock} onClose={() => setConfirmBlock(false)} title={`Block ${name}?`}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>You won&rsquo;t see each other&rsquo;s posts, reviews, annotations, lists or shelves.</li>
          <li>Neither of you can follow, comment on, like or pass books to the other.</li>
          <li>You&rsquo;ll both stop following each other. {first} won&rsquo;t be told.</li>
        </ul>
        <p className="mt-3 text-sm text-ink-soft">You can unblock any time from Settings.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="paper" onClick={() => setConfirmBlock(false)}>Cancel</Button>
          <Button variant="burgundy" disabled={pending} onClick={() => block(true)}>Block</Button>
        </div>
      </Dialog>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="profile" targetId={userId} what={`${first}'s profile`} />
    </div>
  );
}
