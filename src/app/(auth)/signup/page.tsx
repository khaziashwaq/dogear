import { redirect } from "next/navigation";

/** Joining and signing in are the same step now: Google creates the account on first sign-in. */
export default function SignupPage() {
  redirect("/login");
}
