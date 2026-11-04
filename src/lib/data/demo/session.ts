import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDemoDB } from "./db";

export const DEMO_COOKIE = "dogear_demo_session";

function sign(userId: string) {
  return createHmac("sha256", getDemoDB().secret).update(userId).digest("base64url");
}

export function encodeDemoSession(userId: string) {
  return `${userId}.${sign(userId)}`;
}

export function decodeDemoSession(value: string | undefined): string | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i < 0) return null;
  const userId = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(sign(userId));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return getDemoDB().users.some((u) => u.id === userId) ? userId : null;
}
