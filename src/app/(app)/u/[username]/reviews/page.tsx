import { notFound } from "next/navigation";
import { ReviewCard } from "@/components/review/review-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore, getViewer } from "@/lib/auth";
import { lookupProfile } from "@/lib/profile-lookup";

export default async function ProfileReviews({ params }: PageProps<"/u/[username]/reviews">) {
  const profile = await lookupProfile((await params).username);
  if (!profile) notFound();
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  const reviews = await store.listReviewsByUser(profile.id);
  if (reviews.length === 0)
    return <EmptyState title="No reviews yet" body="Stars, sentences, the occasional all-caps meltdown." action={viewer?.id === profile.id ? <ButtonLink href="/review/new">Write a review</ButtonLink> : undefined} />;
  return <div className="mx-auto max-w-3xl space-y-6">{reviews.map((r) => <ReviewCard key={r.id} review={r} showBook />)}</div>;
}
