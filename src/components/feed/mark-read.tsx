"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions/social";

/** Marks notifications read shortly after the page is viewed. */
export function MarkRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(() => void markNotificationsReadAction(), 1500);
    return () => clearTimeout(t);
  }, [unread]);
  return null;
}
