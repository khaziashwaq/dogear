import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "ink" | "burgundy" | "paper" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,color,box-shadow] duration-150 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0";
const variants: Record<Variant, string> = {
  ink: "bg-ink text-paper hover:bg-burgundy shadow-[2px_2px_0_var(--color-burgundy)] hover:shadow-[2px_2px_0_var(--color-ink)]",
  burgundy: "bg-burgundy text-paper hover:bg-burgundy-deep shadow-[2px_2px_0_var(--color-ink)]",
  paper: "bg-card text-ink border border-line-strong hover:border-ink hover:bg-paper",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink-soft hover:text-ink hover:bg-paper-deep",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: Variant = "ink", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], "rounded-[2px]", className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ink", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

export function ButtonLink({
  href,
  variant = "ink",
  size = "md",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
