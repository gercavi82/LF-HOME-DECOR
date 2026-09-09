"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, FileDown, ChevronDown } from "lucide-react";

interface SalesExportMenuProps {
  currentParams: {
    q?: string;
    desde?: string;
    hasta?: string;
    asesor?: string;
    local?: string;
    canal?: string;
    estado?: string;
    mes?: string;
  };
}

export function SalesExportMenu({ currentParams }: SalesExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildExportUrl = (formato: "xlsx" | "pdf" | "csv") => {
    const params = new URLSearchParams();
    params.set("formato", formato);
    if (currentParams.q) params.set("q", currentParams.q);
    if (currentParams.desde) params.set("desde", currentParams.desde);
    if (currentParams.hasta) params.set("hasta", currentParams.hasta);
    if (currentParams.asesor) params.set("asesor", currentParams.asesor);
    if (currentParams.local) params.set("local", currentParams.local);
    if (currentParams.canal) params.set("canal", currentParams.canal);
    if (currentParams.estado) params.set("estado", currentParams.estado);
    if (currentParams.mes) params.set("mes", currentParams.mes);

    return `/api/exportar/ventas?${params.toString()}`;
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
        title="Exportar reporte de ventas"
      >
        <Download size={17} className="text-slate-500" />
        <span>Exportar</span>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-2xl border border-slate-100 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Formatos de reporte
          </div>

          <a
            href={buildExportUrl("xlsx")}
            onClick={() => setIsOpen(false)}
            download
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <p className="font-semibold leading-tight">Excel (.xlsx)</p>
              <p className="text-xs text-slate-400">Con resumen y formato</p>
            </div>
          </a>

          <a
            href={buildExportUrl("pdf")}
            onClick={() => setIsOpen(false)}
            download
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <FileText size={18} />
            </div>
            <div>
              <p className="font-semibold leading-tight">PDF Corporativo</p>
              <p className="text-xs text-slate-400">Membretado y KPIs</p>
            </div>
          </a>

          <a
            href={buildExportUrl("csv")}
            onClick={() => setIsOpen(false)}
            download
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileDown size={18} />
            </div>
            <div>
              <p className="font-semibold leading-tight">CSV (Separado por comas)</p>
              <p className="text-xs text-slate-400">Compatible con Excel UTF-8</p>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
