"use client";

import { useEffect, type ReactNode } from "react";

import { Button } from "./button";

export function Modal({ open, title, description, children, onClose }: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-lf-navy/55 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-lf-surface p-4 shadow-[var(--lf-shadow-lg)] sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-sm text-lf-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>×</Button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
