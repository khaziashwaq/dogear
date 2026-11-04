import "server-only";
import { cache } from "react";
import { getStore } from "@/lib/auth";

export const lookupProfile = cache(async (username: string) => {
  const store = await getStore();
  return store.getProfileByUsername(decodeURIComponent(username));
});
