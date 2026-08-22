import type { ReactNode } from "react";

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-lf-navy px-2.5 py-1.5 text-xs text-white shadow-md group-hover:block group-focus-within:block">
        {content}
      </span>
    </span>
  );
}
