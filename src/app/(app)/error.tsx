"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="paper dogear mx-auto mt-10 max-w-md p-8 text-center" role="alert">
      <p className="hand text-3xl text-burgundy">well, that&rsquo;s a plot twist</p>
      <h1 className="mt-2 text-3xl">Something went wrong loading this page.</h1>
      <p className="mt-2 text-sm text-ink-soft">It&rsquo;s probably temporary. Try again in a moment.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
