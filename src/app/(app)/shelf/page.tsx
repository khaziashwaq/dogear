import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";

export default async function ShelfRedirect() {
  const viewer = await requireViewer("/shelf");
  redirect(`/u/${viewer.username}/shelves`);
}
