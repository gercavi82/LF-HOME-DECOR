"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error", { digest: error.digest }); }, [error]);
  return <main className="grid min-h-[70vh] place-items-center p-4"><section className="w-full max-w-lg rounded-3xl border bg-lf-surface p-7 text-center shadow-[var(--lf-shadow-md)]"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--lf-danger-soft)] text-lf-danger"><AlertTriangle size={26} /></span><h1 className="mt-5 text-2xl font-semibold">No pudimos completar la operación</h1><p className="mt-2 text-sm leading-6 text-lf-muted">Ocurrió un error interno. Tus datos sensibles y la información técnica permanecen protegidos.</p><button onClick={reset} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white"><RefreshCw size={17} /> Intentar nuevamente</button>{error.digest ? <p className="mt-4 font-mono text-xs text-lf-muted">Referencia: {error.digest}</p> : null}</section></main>;
}
