import { notFound } from "next/navigation";
import { AnnotationCard } from "@/components/quote/quote-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";
import { hash } from "@/lib/utils";

/** A reader's marginalia. Drafts are shown only to their owner (the store won't return them to anyone else). */
export default async function ProfileMarginalia({ params }: PageProps<"/u/[username]/quotes">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const all = await store.listQuotesByUser(profile.id, 200);
  const own = viewer?.id === profile.id;
  const drafts = own ? all.filter((q) => q.isDraft) : [];
  const published = all.filter((q) => !q.isDraft);

  const grid = (qs: typeof all) => (
    <div className="masonry columns-1 sm:columns-2 lg:columns-3">
      {qs.map((q) => (
        <div key={q.id} style={{ rotate: `${((hash(q.id) % 5) - 2) * 0.2}deg` }}>
          <AnnotationCard quote={q} href={own && q.isDraft ? `/quotes/${q.id}/edit` : `/quotes/${q.id}`} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-12">
      {own && (
        <div className="flex justify-end">
          <ButtonLink href="/quotes/new">Add a highlight</ButtonLink>
        </div>
      )}
      {drafts.length > 0 && (
        <section aria-labelledby="drafts-h">
          <h2 id="drafts-h" className="mb-4 text-2xl">
            Drafts <span className="font-sans text-sm text-ink-faint">only you can see these</span>
          </h2>
          {grid(drafts)}
        </section>
      )}
      {published.length === 0 ? (
        <EmptyState
          title={own ? "Nothing dog-eared yet" : "No marginalia yet"}
          body={own ? "Save a passage you loved and what it made you think. It'll live here." : `${profile.displayName} hasn't shared any marked passages yet.`}
          action={own ? <ButtonLink href="/quotes/new">Add a highlight</ButtonLink> : undefined}
        />
      ) : (
        <section aria-label="Marginalia">{grid(published)}</section>
      )}
    </div>
  );
}
