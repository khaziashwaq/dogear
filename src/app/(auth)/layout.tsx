import { Logo } from "@/components/brand/logo";
import { DemoBanner } from "@/components/layout/demo-banner";
import { Leaf, Sparkle } from "@/components/ui/doodles";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="px-5 py-5 sm:px-8"><Logo /></header>
      <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <Leaf className="pointer-events-none absolute bottom-10 left-[8%] hidden text-sage-deep/60 lg:block" />
        <Sparkle className="pointer-events-none absolute right-[12%] top-[18%] hidden size-8 text-burgundy/50 lg:block" />
        {children}
      </main>
    </div>
  );
}
