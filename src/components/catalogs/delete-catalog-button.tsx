"use client";

import { Trash2 } from "lucide-react";

import { deleteCatalogAction } from "@/app/(protected)/configuracion/catalogos/actions";

export function DeleteCatalogButton({ catalog, id, name }: { catalog: string; id: number; name: string }) {
  return (
    <form action={deleteCatalogAction} onSubmit={(event) => { if (!window.confirm(`¿Eliminar definitivamente “${name}”?`)) event.preventDefault(); }}>
      <input type="hidden" name="catalogo" value={catalog} /><input type="hidden" name="id" value={id} />
      <button type="submit" className="grid size-9 place-items-center rounded-lg text-lf-danger hover:bg-[var(--lf-danger-soft)]" aria-label={`Eliminar ${name}`}><Trash2 size={16} aria-hidden="true" /></button>
    </form>
  );
}
