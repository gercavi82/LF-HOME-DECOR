import type { ReactNode } from "react";

import { cn } from "@/src/lib/cn";

export function ContentContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lf-terracotta">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-lf-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-col gap-2 [&>*]:w-full sm:w-auto sm:flex-row sm:flex-wrap sm:[&>*]:w-auto">{actions}</div> : null}
    </header>
  );
}
