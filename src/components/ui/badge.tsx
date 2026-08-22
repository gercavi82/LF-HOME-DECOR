import type { HTMLAttributes } from "react";

import { cn } from "@/src/lib/cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-lf-surface-muted text-lf-navy",
  success: "bg-[var(--lf-success-soft)] text-lf-success",
  warning: "bg-[var(--lf-warning-soft)] text-lf-warning",
  danger: "bg-[var(--lf-danger-soft)] text-lf-danger",
  info: "bg-[var(--lf-info-soft)] text-lf-info",
};

export function Badge({ className, variant = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", variants[variant], className)} {...props} />;
}
