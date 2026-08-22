import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-[70vh] place-items-center p-4"><section className="w-full max-w-lg rounded-3xl border bg-lf-surface p-7 text-center shadow-[var(--lf-shadow-md)]"><SearchX size={42} className="mx-auto text-lf-terracotta" /><p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-lf-muted">NOT_FOUND</p><h1 className="mt-2 text-2xl font-semibold">Página no encontrada</h1><p className="mt-2 text-sm text-lf-muted">La dirección solicitada no existe o ya no está disponible.</p><Link href="/dashboard" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white"><ArrowLeft size={17} /> Volver al inicio</Link></section></main>;
}
