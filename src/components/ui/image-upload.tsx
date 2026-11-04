"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { uploadImageAction } from "@/app/actions/profile";
import { useToast } from "./toast";

export function ImageUpload({ kind, value, onChange, label }: { kind: "avatar" | "cover" | "list"; value: string | null; onChange: (url: string | null) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="flex items-center gap-3">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="size-14 border border-line object-cover" />
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const fd = new FormData();
          fd.set("file", file);
          fd.set("kind", kind);
          const res = await uploadImageAction(fd);
          setBusy(false);
          e.target.value = "";
          if (!res.ok) return toast(res.error, "error");
          onChange(res.data);
        }}
      />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-2 border border-dashed border-line-strong px-3 py-2 text-sm hover:border-ink">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {value ? "Replace" : label}
      </button>
      {value && <button type="button" onClick={() => onChange(null)} className="meta inline-flex items-center gap-1 hover:text-burgundy"><X className="size-3" /> remove</button>}
      <span className="meta normal-case tracking-normal text-ink-faint">JPG/PNG/WebP, up to 2 MB</span>
    </div>
  );
}
