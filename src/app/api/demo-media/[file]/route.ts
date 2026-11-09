import { isDemoMode } from "@/lib/env";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** Demo mode only: serves images uploaded to the local demo store. */
export async function GET(_req: Request, ctx: RouteContext<"/api/demo-media/[file]">) {
  if (!isDemoMode) return new Response("Not found", { status: 404 });
  const { file } = await ctx.params;
  const { readDemoUpload } = await import("@/lib/data/demo/uploads");
  const bytes = readDemoUpload(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
