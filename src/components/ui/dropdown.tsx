import type { ReactNode } from "react";

export function Dropdown({ label, children, align = "right" }: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <details className="group relative">
      <summary className="list-none cursor-pointer rounded-xl focus-visible:outline-none [&::-webkit-details-marker]:hidden">{label}</summary>
      <div className={`absolute z-40 mt-2 min-w-52 rounded-xl border bg-lf-surface p-1.5 shadow-[var(--lf-shadow-md)] ${align === "right" ? "right-0" : "left-0"}`}>
        {children}
      </div>
    </details>
  );
}

export function DropdownItem({ children }: { children: ReactNode }) {
  return <div className="rounded-lg px-3 py-2 text-sm transition hover:bg-lf-surface-muted">{children}</div>;
}
