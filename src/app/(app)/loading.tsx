import { FeedSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="mx-auto max-w-2xl"><div className="skeleton mb-8 h-12 w-64" /><FeedSkeleton count={3} /></div>;
}
