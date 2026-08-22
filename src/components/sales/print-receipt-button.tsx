"use client";

import { Printer } from "lucide-react";

export function PrintReceiptButton() {
  return <button type="button" onClick={() => window.print()} className="no-print inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Printer size={17} /> Imprimir</button>;
}
