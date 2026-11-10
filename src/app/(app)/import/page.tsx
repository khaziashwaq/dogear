import type { Metadata } from "next";
import { GoodreadsImport } from "@/components/import/goodreads-import";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Import from Goodreads" };

export default async function ImportPage() {
  const viewer = await requireViewer("/import");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-5xl leading-none">Bring your shelves<span className="text-burgundy">.</span></h1>
      <p className="hand mt-1 text-2xl text-ink-soft">every book you&rsquo;ve logged on Goodreads, moved in one go</p>
      <div className="mt-8"><GoodreadsImport username={viewer.username ?? ""} /></div>
    </div>
  );
}
