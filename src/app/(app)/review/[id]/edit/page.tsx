import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/review/review-form";
import { getStore, requireViewer } from "@/lib/auth";

export default async function EditReviewPage({ params }: PageProps<"/review/[id]/edit">) {
  const viewer = await requireViewer();
  const store = await getStore();
  const review = await store.getReview((await params).id);
  if (!review || review.userId !== viewer.id) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-5xl">Edit review</h1>
      <div className="paper dogear p-5 sm:p-8"><ReviewForm initialBook={review.book} existing={review} suggestions={[]} /></div>
    </div>
  );
}
