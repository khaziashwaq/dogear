import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Onboarding } from "@/components/auth/onboarding";
import { getViewer } from "@/lib/auth";
import { GENRES } from "@/lib/data/seed/books";

export const metadata: Metadata = { title: "Welcome" };

const AUTHOR_IDEAS = [
  "Sally Rooney", "Donna Tartt", "Madeline Miller", "Kazuo Ishiguro", "Haruki Murakami", "Toni Morrison", "Ursula K. Le Guin",
  "Shirley Jackson", "Jane Austen", "Ocean Vuong", "R. F. Kuang", "Virginia Woolf", "Octavia E. Butler", "Taylor Jenkins Reid",
];

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.onboarded && viewer.username) redirect("/home");
  return <Onboarding viewer={viewer} genres={[...GENRES]} authorIdeas={AUTHOR_IDEAS} />;
}
