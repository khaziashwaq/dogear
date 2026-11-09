"use client";

import { useState, useTransition } from "react";
import { reportAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ReportReason, ReportTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

const REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "spam", label: "Spam", hint: "Ads, scams, or the same thing over and over" },
  { value: "harassment", label: "Harassment", hint: "Targeting or bullying someone" },
  { value: "hate", label: "Hate", hint: "Attacks on people for who they are" },
  { value: "sexual", label: "Sexual content", hint: "Explicit or unwanted sexual material" },
  { value: "spoilers", label: "Unmarked spoilers", hint: "Gives away a book without a warning" },
  { value: "other", label: "Something else", hint: "Tell us below" },
];

/** Report a profile, post, comment, review, annotation or list. Reports are private to the reporter. */
export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  what,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  /** e.g. "this comment", "Ada's profile". */
  what: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = () =>
    start(async () => {
      if (!reason) return;
      const res = await reportAction({ targetType, targetId, reason, details: details || null });
      if (!res.ok) return toast(res.error, "error");
      toast("Report sent. Thank you for looking out for other readers.");
      setReason(null);
      setDetails("");
      onClose();
    });

  return (
    <Dialog open={open} onClose={onClose} title={`Report ${what}`} description="Only you and the people who review reports will see this.">
      <fieldset>
        <legend className="sr-only">What&rsquo;s wrong?</legend>
        <div className="grid gap-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 border px-3 py-2.5 transition-colors",
                reason === r.value ? "border-ink bg-paper-deep" : "border-line-strong hover:border-ink",
              )}
            >
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="mt-1 accent-burgundy" />
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-ink-soft">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block">
        <span className="meta mb-1.5 block">Anything we should know? (optional)</span>
        <textarea className="field min-h-20 text-sm" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="paper" onClick={onClose}>Cancel</Button>
        <Button variant="burgundy" disabled={!reason || pending} onClick={submit}>{pending ? "Sending…" : "Send report"}</Button>
      </div>
    </Dialog>
  );
}
