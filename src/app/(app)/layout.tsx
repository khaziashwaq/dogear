import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DemoBanner } from "@/components/layout/demo-banner";
import { NAV_COOKIE } from "@/components/layout/nav-cookie";
import { ShellClient } from "@/components/layout/shell-client";
import { ViewerProvider } from "@/components/providers/viewer";
import { getStore, getViewer } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [store, viewer, jar] = await Promise.all([getStore(), getViewer(), cookies()]);
  // Remembered across visits, and read here so the first paint already has the right width.
  const navCollapsed = jar.get(NAV_COOKIE)?.value === "collapsed";
  if (viewer && (!viewer.onboarded || !viewer.username)) redirect("/onboarding");
  const [followingIds, unread] = viewer ? await Promise.all([store.followingIds(), store.unreadNotificationCount()]) : [[], 0];
  return (
    <ViewerProvider viewer={viewer} followingIds={followingIds}>
      <DemoBanner />
      <ShellClient viewer={viewer} unread={unread} navCollapsed={navCollapsed}>{children}</ShellClient>
    </ViewerProvider>
  );
}
