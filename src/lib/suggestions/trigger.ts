import "server-only";
import { after } from "next/server";
import { getStore } from "@/lib/auth";
import { refreshSuggestions } from "./service";
import { liveSources } from "./sources";

/**
 * After a shelf change, rebuild the reader's suggestions once the response has gone out.
 * Never blocks or fails the shelf change itself: any error is logged and the list is rebuilt
 * on the next visit instead (the library fingerprint will still differ).
 */
export function refreshSuggestionsSoon() {
  after(async () => {
    try {
      const store = await getStore();
      if (store.viewerId) await refreshSuggestions(store, liveSources(store));
    } catch (err) {
      console.warn("[dogear suggestions] background refresh failed", err);
    }
  });
}
