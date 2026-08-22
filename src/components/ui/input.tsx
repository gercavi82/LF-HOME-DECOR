import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/src/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  endAdornment?: ReactNode;
};

export function Input({ className, id, label, error, hint, endAdornment, ...props }: InputProps) {
  const inputId = id ?? props.name;
  const descriptionId = inputId ? `${inputId}-description` : undefined;

  return (
    <label htmlFor={inputId} className="block space-y-2 text-sm font-medium">
      {label ? <span>{label}</span> : null}
      <span className={cn(
        "flex min-h-11 overflow-hidden rounded-xl border bg-lf-surface transition focus-within:border-lf-terracotta focus-within:ring-2 focus-within:ring-lf-terracotta/20",
        error && "border-lf-danger",
      )}>
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-lf-navy outline-none placeholder:text-lf-muted/70 disabled:cursor-not-allowed disabled:bg-lf-surface-muted",
            className,
          )}
          {...props}
        />
        {endAdornment ? <span className="flex items-center pr-3">{endAdornment}</span> : null}
      </span>
      {error || hint ? (
        <span id={descriptionId} className={cn("block text-xs", error ? "text-lf-danger" : "text-lf-muted")}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}
