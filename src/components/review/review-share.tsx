"use client";

import { Download, ImageIcon } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ShareButton } from "@/components/ui/share-button";
import { SHARE_TEMPLATES, type ShareTemplate } from "@/lib/share-cards";
import { cn } from "@/lib/utils";

type Format = { key: "portrait" | "story" | "og"; label: string; aspect: string };
const FORMATS: Record<Format["key"], Format> = {
  portrait: { key: "portrait", label: "Post · 1080 × 1350", aspect: "aspect-[4/5]" },
  story: { key: "story", label: "Story · 1080 × 1920", aspect: "aspect-[9/16]" },
  og: { key: "og", label: "Wide · 1200 × 630", aspect: "aspect-[1200/630]" },
};

/**
 * Share something as a link (with its Open Graph card) or as a composed image in one of
 * four templates and a choice of sizes. Images are only generated once the dialog opens.
 */
export function ShareImages({
  pagePath,
  cardPath,
  title,
  fileStem,
  formats = ["portrait", "og"],
  dialogTitle = "Share as an image",
}: {
  pagePath: string;
  cardPath: string;
  title: string;
  fileStem: string;
  formats?: Format["key"][];
  dialogTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<ShareTemplate>("minimal");
  const [format, setFormat] = useState<Format["key"]>(formats[0]);
  const join = cardPath.includes("?") ? "&" : "?";
  const src = (t: ShareTemplate, f: Format["key"]) => `${cardPath}${join}template=${t}${f === "portrait" ? "" : `&format=${f}`}`;
  const current = FORMATS[format];

  return (
    <div className="flex flex-wrap gap-2">
      <ShareButton path={pagePath} title={title} label="Share link" />
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ink", "md")}>
        <ImageIcon className="size-4" /> Share as an image
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={dialogTitle} description="Pick a look and a size, then download it.">
        {open && (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className={cn("relative mx-auto max-h-[60vh] w-full overflow-hidden border border-line bg-paper-deep", current.aspect, format === "story" && "max-w-[18rem]")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${template}-${format}`}
                src={src(template, format)}
                alt={`${title} — ${SHARE_TEMPLATES.find((t) => t.key === template)?.label} share card`}
                className="absolute inset-0 size-full object-contain"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                {SHARE_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="radio"
                    aria-checked={template === t.key}
                    onClick={() => setTemplate(t.key)}
                    className={cn("border px-3 py-2 text-left text-sm transition-colors", template === t.key ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {formats.length > 1 && (
                <div role="radiogroup" aria-label="Size" className="mt-2 grid gap-1">
                  {formats.map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={format === f}
                      onClick={() => setFormat(f)}
                      className={cn("px-2 py-1 text-left font-mono text-xs transition-colors", format === f ? "bg-paper-deep text-ink" : "text-ink-soft hover:text-ink")}
                    >
                      {FORMATS[f].label}
                    </button>
                  ))}
                </div>
              )}
              <a href={src(template, format)} download={`${fileStem}-${template}-${format}.png`} className={buttonClass("burgundy", "md", "mt-auto")}>
                <Download className="size-4" /> Download
              </a>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** Reviews: post-sized and wide (link-preview) images. */
export function ReviewShare(props: { pagePath: string; cardPath: string; title: string; fileStem: string }) {
  return <ShareImages {...props} formats={["portrait", "og"]} />;
}
