import type { ReactNode } from "react";

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-current">
      <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-lf-surface px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-lf-surface-muted text-xl text-lf-terracotta" aria-hidden="true">◇</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-lf-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
