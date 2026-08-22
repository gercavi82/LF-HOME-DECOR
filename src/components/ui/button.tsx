import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/src/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-lf-terracotta text-white shadow-sm hover:bg-lf-terracotta-hover",
  secondary: "bg-lf-navy text-white shadow-sm hover:bg-lf-navy-soft",
  outline: "border border-lf-border bg-lf-surface text-lf-navy hover:border-lf-terracotta hover:bg-lf-surface-muted",
  ghost: "text-lf-navy hover:bg-lf-surface-muted",
  danger: "bg-lf-danger text-white shadow-sm hover:brightness-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-lg px-3 text-sm",
  md: "h-11 rounded-xl px-4 text-sm",
  lg: "h-12 rounded-xl px-5",
  icon: "size-11 rounded-xl",
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant], sizes[size], className,
      )}
      {...props}
    />
  );
}
