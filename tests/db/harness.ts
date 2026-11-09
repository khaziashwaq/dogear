// A real Postgres (PGlite, in-process) with the Supabase pieces our migrations expect, then every
// migration in supabase/migrations applied in order. Tests run queries as `anon`, `authenticated`
// (with auth.uid() set) or the table owner, so RLS, column grants and triggers behave as deployed.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = path.join(ROOT, "supabase/migrations");

export type Db = PGlite;

export async function createDb(): Promise<Db> {
  const db = await PGlite.create({ extensions: { citext, pg_trgm } });
  await db.exec(readFileSync(path.join(import.meta.dirname, "supabase-shim.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Create a signed-up reader (auth.users row → profile via the signup trigger), onboarded with a username. */
export async function createUser(db: Db, username: string, meta: Record<string, string> = {}) {
  const id = crypto.randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, `${username}@example.com`, JSON.stringify(meta)]);
  await db.query("update public.profiles set username = $2, display_name = $3, onboarded = true where id = $1", [id, username, username]);
  return id;
}

type Role = { as: "anon" } | { as: "user"; id: string } | { as: "service" };

/**
 * Run `fn` inside a transaction as an API role. Changes are kept unless `fn` throws.
 * Errors are rethrown with Postgres's code so tests can assert on them.
 */
export async function asRole<T>(db: Db, role: Role, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (role.as === "anon") {
      await tx.exec("set local role anon");
    } else if (role.as === "service") {
      await tx.exec("set local role service_role");
    } else {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [role.id]);
      await tx.exec("set local role authenticated");
    }
    return fn(tx);
  });
}

export const asUser = <T>(db: Db, id: string, fn: (tx: Transaction) => Promise<T>) => asRole(db, { as: "user", id }, fn);
export const asAnon = <T>(db: Db, fn: (tx: Transaction) => Promise<T>) => asRole(db, { as: "anon" }, fn);

/** The Postgres error code a promise rejects with (or null if it resolves). */
export async function pgError(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return err.code ?? err.message ?? "error";
  }
}
