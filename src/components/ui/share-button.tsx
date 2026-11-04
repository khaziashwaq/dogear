"use client";

import { Share } from "lucide-react";
import { buttonClass } from "./button";
import { useToast } from "./toast";

export function ShareButton({ path, title, label = "Share" }: { path: string; title: string; label?: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={buttonClass("paper", "md")}
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          if (navigator.share) await navigator.share({ url, title });
          else {
            await navigator.clipboard.writeText(url);
            toast("Link copied");
          }
        } catch {
          /* dismissed */
        }
      }}
    >
      <Share className="size-4" /> {label}
    </button>
  );
}
