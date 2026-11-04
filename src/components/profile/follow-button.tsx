"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleFollowAction } from "@/app/actions/social";
import { useViewer } from "@/components/providers/viewer";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function FollowButton({ userId, name, size = "sm", variant = "button", className }: { userId: string; name: string; size?: "sm" | "md"; variant?: "button" | "text"; className?: string }) {
  const { viewer, isFollowing, setFollowing } = useViewer();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (viewer?.id === userId) return null;
  const following = isFollowing(userId);

  const onClick = () => {
    if (!viewer) return router.push("/login");
    setFollowing(userId, !following);
    start(async () => {
      const res = await toggleFollowAction(userId, !following);
      if (!res.ok) {
        setFollowing(userId, following);
        toast(res.error, "error");
      } else if (!following) toast(`Following ${name}`);
    });
  };

  if (variant === "text") {
    return (
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={following} className={cn("meta text-burgundy hover:text-ink", className)}>
        {following ? "Following" : "+ Follow"}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} aria-pressed={following} className={buttonClass(following ? "paper" : "ink", size, cn("min-w-24", className))}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
