"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/app/actions/profile";
import { setBlockedAction, setMutedAction } from "@/app/actions/social";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { Profile } from "@/lib/types";

/** Readers you've blocked or muted, each with a way back. */
export function SafetyList({ people, kind }: { people: Profile[]; kind: "blocked" | "muted" }) {
  const [list, setList] = useState(people);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (list.length === 0) {
    return <p className="text-sm text-ink-soft">{kind === "blocked" ? "You haven't blocked anyone." : "You haven't muted anyone."}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <Avatar profile={p} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {p.displayName} <span className="text-ink-faint">@{p.username}</span>
          </span>
          <Button
            size="sm"
            variant="paper"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = kind === "blocked" ? await setBlockedAction(p.id, false) : await setMutedAction(p.id, false);
                if (!res.ok) return toast(res.error, "error");
                setList((l) => l.filter((x) => x.id !== p.id));
                toast(kind === "blocked" ? `Unblocked ${p.displayName}` : `Unmuted ${p.displayName}`);
                router.refresh();
              })
            }
          >
            {kind === "blocked" ? "Unblock" : "Unmute"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Permanent account deletion, behind a typed confirmation. */
export function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed.trim().toLowerCase() === username.toLowerCase();
  return (
    <>
      <Button variant="outline" className="border-burgundy text-burgundy hover:bg-burgundy" onClick={() => setOpen(true)}>Delete account…</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?">
        <p className="text-sm text-ink-soft">
          This permanently deletes your profile, shelves, diary, reviews, annotations (drafts too), lists, comments, likes and uploaded
          images, and signs you out. It can&rsquo;t be undone. Download your data first if you&rsquo;d like a copy.
        </p>
        <label className="mt-4 block">
          <span className="meta mb-1.5 block">Type your username, {username}, to confirm</span>
          <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-burgundy">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="paper" onClick={() => setOpen(false)}>Keep my account</Button>
          <Button
            variant="burgundy"
            disabled={!matches || pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await deleteAccountAction(typed);
                // On success the action signs out and redirects; we only get here on failure.
                if (res && !res.ok) setError(res.error);
              })
            }
          >
            {pending ? "Deleting…" : "Delete forever"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
