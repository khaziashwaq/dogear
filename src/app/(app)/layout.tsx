import { redirect } from "next/navigation";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ShellClient } from "@/components/layout/shell-client";
import { ViewerProvider } from "@/components/providers/viewer";
import { getStore, getViewer } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [store, viewer] = await Promise.all([getStore(), getViewer()]);
  if (viewer && (!viewer.onboarded || !viewer.username)) redirect("/onboarding");
  const [followingIds, unread] = viewer ? await Promise.all([store.followingIds(), store.unreadNotificationCount()]) : [[], 0];
  return (
    <ViewerProvider viewer={viewer} followingIds={followingIds}>
      <DemoBanner />
      <ShellClient viewer={viewer} unread={unread}>{children}</ShellClient>
    </ViewerProvider>
  );
}
