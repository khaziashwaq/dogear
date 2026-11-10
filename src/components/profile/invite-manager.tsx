"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createInviteAction, deleteInviteAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Invite } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const EXPIRY = [
  { label: "a week", days: 7 },
  { label: "a month", days: 30 },
  { label: "never", days: null },
] as const;

/** Make and share invite links. You see how many people joined with each, never who. */
export function InviteManager({ initial, origin }: { initial: Invite[]; origin: string }) {
  const [invites, setInvites] = useState(initial);
  const [days, setDays] = useState<number | null>(30);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const link = (code: string) => `${origin}/invite/${code}`;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(link(code));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      toast("Couldn't copy. Select the link and copy it instead.", "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="meta">Link works for</span>
        <div role="radiogroup" aria-label="Link works for" className="inline-flex border border-line-strong bg-card p-0.5">
          {EXPIRY.map((e) => (
            <button
              key={e.label}
              type="button"
              role="radio"
              aria-checked={days === e.days}
              onClick={() => setDays(e.days)}
              className={days === e.days ? "bg-ink px-2.5 py-1 text-xs text-paper" : "px-2.5 py-1 text-xs text-ink-soft hover:text-ink"}
            >
              {e.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createInviteAction({ expiresInDays: days, maxUses: null });
              if (!res.ok) return toast(res.error, "error");
              setInvites((l) => [res.data, ...l]);
              await copy(res.data.code);
              toast("Invite link copied");
            })
          }
        >
          {pending ? "Making…" : "New invite link"}
        </Button>
      </div>
      {invites.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {invites.map((i) => {
            const expired = i.closed;
            return (
              <li key={i.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">{link(i.code)}</code>
                <span className="meta normal-case tracking-normal">
                  {i.uses} joined · {expired ? "closed" : i.expiresAt ? `until ${formatDate(i.expiresAt)}` : "no expiry"}
                </span>
                <button type="button" onClick={() => copy(i.code)} disabled={expired} aria-label="Copy invite link" className="p-1 text-ink-faint hover:text-ink disabled:opacity-40">
                  {copied === i.code ? <Check className="size-4 text-sage-deep" /> : <Copy className="size-4" />}
                </button>
                <button
                  type="button"
                  aria-label="Delete invite link"
                  className="p-1 text-ink-faint hover:text-burgundy"
                  onClick={() =>
                    start(async () => {
                      const res = await deleteInviteAction(i.code);
                      if (!res.ok) return toast(res.error, "error");
                      setInvites((l) => l.filter((x) => x.code !== i.code));
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
