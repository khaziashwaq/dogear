import { notFound } from "next/navigation";
import { ReaderRow } from "@/components/profile/reader-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";

export default async function Page({ params }: PageProps<"/u/[username]/following">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const store = await getStore();
  const people = await store.listFollowing(profile.id);
  return (
    <section className="mx-auto max-w-xl">
      <h2 className="mb-6 text-3xl">Following</h2>
      {people.length === 0 ? (
        <EmptyState title="Not following anyone yet" body="Readers find each other through reviews, lists and quotes." />
      ) : (
        <div className="space-y-4">{people.map((p) => <ReaderRow key={p.id} profile={p} note={p.bio.slice(0, 70)} />)}</div>
      )}
    </section>
  );
}
