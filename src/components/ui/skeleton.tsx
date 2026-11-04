import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[2px]", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="paper p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-20" /></div>
      </div>
      <div className="mt-5 flex gap-4">
        <Skeleton className="aspect-[2/3] w-20 shrink-0" />
        <div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" /></div>
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <PostSkeleton key={i} />)}
    </div>
  );
}

export function CoverGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="aspect-[2/3] w-full" />)}
    </div>
  );
}
