import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".data", "uploads");
const g = globalThis as unknown as { __dogearUploads?: Map<string, Buffer> };
const memory = (g.__dogearUploads ??= new Map());

export function saveDemoUpload(userId: string, name: string, bytes: Buffer): string {
  const file = `${userId}-${name}`.replace(/[^a-zA-Z0-9._-]/g, "");
  memory.set(file, bytes);
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    writeFileSync(path.join(DIR, file), bytes);
  } catch {
    // in-memory only on read-only filesystems
  }
  return `/api/demo-media/${file}`;
}

export function readDemoUpload(file: string): Buffer | null {
  const safe = file.replace(/[^a-zA-Z0-9._-]/g, "");
  if (memory.has(safe)) return memory.get(safe)!;
  try {
    return readFileSync(path.join(DIR, safe));
  } catch {
    return null;
  }
}
