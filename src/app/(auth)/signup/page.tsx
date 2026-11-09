import { redirect } from "next/navigation";
import { connection } from "next/server";

/** Joining and signing in are the same step now: Google creates the account on first sign-in. */
export default async function SignupPage() {
  await connection();
  redirect("/login");
}
