import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[280px_1fr]" role="status" aria-label="Loading book">
      <div className="space-y-4"><Skeleton className="mx-auto aspect-[2/3] w-48 md:w-full" /><Skeleton className="h-24 w-full" /></div>
      <div className="space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-14 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="mt-8 h-24 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>
    </div>
  );
}
