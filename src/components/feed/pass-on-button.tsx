"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { PassDialog } from "@/components/book/shelf-actions";
import { Button } from "@/components/ui/button";
import type { Profile, SavedBook } from "@/lib/types";

/** Continue a book trail: pass a book you were recommended to someone else. */
export function PassOnButton({ book, following, parentId }: { book: SavedBook; following: Profile[]; parentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="paper" size="sm" onClick={() => setOpen(true)}><Send className="size-3.5" /> Pass it on</Button>
      <PassDialog open={open} onClose={() => setOpen(false)} book={book} following={following} parentId={parentId} />
    </>
  );
}
