import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/src/lib/cn";

type AlertVariant = "success" | "warning" | "danger" | "info";

const variants: Record<AlertVariant, string> = {
  success: "border-lf-success/20 bg-[var(--lf-success-soft)] text-lf-success",
  warning: "border-lf-warning/20 bg-[var(--lf-warning-soft)] text-lf-warning",
  danger: "border-lf-danger/20 bg-[var(--lf-danger-soft)] text-lf-danger",
  info: "border-lf-info/20 bg-[var(--lf-info-soft)] text-lf-info",
};

export function Alert({ title, children, variant = "info", className, ...props }: HTMLAttributes<HTMLDivElement> & { title?: string; variant?: AlertVariant; children: ReactNode }) {
  return (
    <div role={variant === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", variants[variant], className)} {...props}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cn(title && "mt-1", "leading-5")}>{children}</div>
    </div>
  );
}
