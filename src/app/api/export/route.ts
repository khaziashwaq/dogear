import { getStore } from "@/lib/auth";

/** Download everything the signed-in reader has created, as JSON. */
export async function GET() {
  const store = await getStore();
  if (!store.viewerId) return new Response("Sign in to download your data.", { status: 401 });
  const data = await store.exportMyData();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dogear-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
