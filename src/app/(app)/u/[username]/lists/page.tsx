import { notFound } from "next/navigation";
import { ListCard } from "@/components/list/list-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";

export default async function ProfileLists({ params }: PageProps<"/u/[username]/lists">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const own = viewer?.id === profile.id;
  const [lists, followed] = await Promise.all([store.listListsByUser(profile.id), own ? store.followedLists() : Promise.resolve([])]);
  return (
    <div className="space-y-12">
      {own && <div className="flex justify-end"><ButtonLink href="/lists/new">+ New list</ButtonLink></div>}
      {lists.length === 0 ? (
        <EmptyState title="No lists yet" body="Books that feel like a season, a person, a song." action={own ? <ButtonLink href="/lists/new">Make a list</ButtonLink> : undefined} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{lists.map((l) => <ListCard key={l.id} list={l} showOwner={false} />)}</div>
      )}
      {followed.length > 0 && (
        <section>
          <SectionHeading title="Lists you follow" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{followed.map((l) => <ListCard key={l.id} list={l} />)}</div>
        </section>
      )}
    </div>
  );
}
