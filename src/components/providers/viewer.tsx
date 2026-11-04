"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Profile } from "@/lib/types";

interface ViewerState {
  viewer: Profile | null;
  isFollowing: (id: string) => boolean;
  setFollowing: (id: string, on: boolean) => void;
}

const Ctx = createContext<ViewerState>({ viewer: null, isFollowing: () => false, setFollowing: () => {} });

/** Client-side view of who is signed in and whom they follow, for optimistic UI. */
export function ViewerProvider({ viewer, followingIds, children }: { viewer: Profile | null; followingIds: string[]; children: React.ReactNode }) {
  const [following, setSet] = useState(() => new Set(followingIds));
  const setFollowing = useCallback((id: string, on: boolean) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ viewer, isFollowing: (id: string) => following.has(id), setFollowing }), [viewer, following, setFollowing]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useViewer = () => useContext(Ctx);
