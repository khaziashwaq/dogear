"use client";

import { BookHeart, Library, MessageSquareQuote, PenLine } from "lucide-react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";

const OPTIONS = [
  { href: "/home?compose=1", label: "Reading update", body: "Where you are, how it's going.", icon: PenLine, tone: "bg-butter/60" },
  { href: "/review/new", label: "Review", body: "Stars, thoughts, maybe spoilers.", icon: BookHeart, tone: "bg-rose/50" },
  { href: "/quotes/new", label: "Quote", body: "Save a passage you loved.", icon: MessageSquareQuote, tone: "bg-sage/50" },
  { href: "/lists/new", label: "List", body: "Curate a little collection.", icon: Library, tone: "bg-paper-shade" },
];

export function CreateMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Leave a little piece of yourself" description="What are you making today?">
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ href, label, body, icon: Icon, tone }, i) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`group border border-line-strong p-4 transition-transform hover:-translate-y-0.5 hover:border-ink ${tone}`}
            style={{ rotate: `${[-0.6, 0.5, 0.4, -0.5][i]}deg` }}
          >
            <Icon className="size-5 text-burgundy transition-transform group-hover:-rotate-6" strokeWidth={1.6} />
            <p className="mt-3 font-serif text-xl leading-none">{label}</p>
            <p className="mt-1 text-xs text-ink-soft">{body}</p>
          </Link>
        ))}
      </div>
    </Dialog>
  );
}
