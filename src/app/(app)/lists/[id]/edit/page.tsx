import { notFound } from "next/navigation";
import { ListForm } from "@/components/list/list-form";
import { getStore, requireViewer } from "@/lib/auth";

export default async function EditListPage({ params }: PageProps<"/lists/[id]/edit">) {
  const viewer = await requireViewer();
  const list = await (await getStore()).getList((await params).id);
  if (!list || list.userId !== viewer.id) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-5xl">Edit list</h1>
      <ListForm existing={list} />
    </div>
  );
}
