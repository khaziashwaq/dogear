"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteSessionAction } from "@/app/actions/books";
import { useToast } from "@/components/ui/toast";

export function DeleteSessionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Delete this diary entry"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this diary entry?")) return;
        start(async () => {
          const res = await deleteSessionAction(id);
          if (!res.ok) return toast(res.error, "error");
          toast("Entry deleted");
          router.refresh();
        });
      }}
      className="rounded p-1.5 text-ink-faint opacity-60 hover:bg-paper-deep hover:text-burgundy hover:opacity-100"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
