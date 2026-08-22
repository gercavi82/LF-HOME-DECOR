import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/src/lib/cn";

export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div tabIndex={0} role="region" aria-label="Tabla desplazable" className={cn("max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border bg-lf-surface shadow-[inset_-12px_0_12px_-16px_rgba(23,40,59,.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lf-terracotta/30", className)} {...props} />;
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full min-w-[42rem] border-collapse text-sm", className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("bg-lf-surface-muted px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-lf-muted sm:px-4", className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t px-3 py-3 align-middle sm:px-4", className)} {...props} />;
}
