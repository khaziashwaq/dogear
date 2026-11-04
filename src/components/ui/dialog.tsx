"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trapping, Esc and
 * inert background for free). Renders as a bottom sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "dialog m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto border border-line-strong bg-card p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]",
        "sm:m-auto sm:max-h-[88dvh] sm:rounded-[2px]",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        className,
      )}
    >
      {open && (
        <div className="relative px-5 pb-6 pt-5 sm:px-7 sm:pt-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-2xl leading-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-ink-soft hover:bg-paper-deep hover:text-ink" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
