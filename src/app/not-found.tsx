import { connection } from "next/server";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFound() {
  // Rendered per request so its scripts carry the CSP nonce.
  await connection();
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-serif text-[7rem] italic leading-none text-burgundy">404</p>
      <h1 className="mt-2 text-3xl">This page has been torn out.</h1>
      <p className="hand mt-2 text-2xl text-ink-soft">someone dog-eared the wrong corner</p>
      <div className="mt-8 flex gap-2"><ButtonLink href="/home">Back to your shelves</ButtonLink><ButtonLink href="/discover" variant="paper">Discover</ButtonLink></div>
    </main>
  );
}
