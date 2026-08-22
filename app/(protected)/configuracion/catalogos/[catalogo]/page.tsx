import { ArrowLeft, CheckCircle2, CircleOff, Pencil, Plus, Save } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveCatalogAction, setCatalogStatusAction } from "@/app/(protected)/configuracion/catalogos/actions";
import { DeleteCatalogButton } from "@/src/components/catalogs/delete-catalog-button";
import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { catalogDefinitions, listCatalogItems, parseCatalogKey, type CatalogField } from "@/src/services/catalogs/catalogs";

const fieldLabels: Record<CatalogField, string> = {
  codigo: "Código",
  descripcion: "Descripción",
  codigo_hex: "Color hexadecimal",
};

export default async function CatalogPage({ params, searchParams }: {
  params: Promise<{ catalogo: string }>;
  searchParams: Promise<{ editar?: string; success?: string; error?: string }>;
}) {
  const { catalogo: rawCatalog } = await params;
  const key = parseCatalogKey(rawCatalog);
  if (!key) notFound();
  const query = await searchParams;
  const definition = catalogDefinitions[key];
  const items = await listCatalogItems(key);
  const editingId = Number(query.editar);
  const editing = Number.isInteger(editingId) ? items.find((item) => item.id === editingId) : undefined;

  return (
    <ContentContainer>
      <PageHeader eyebrow="Configuración · Catálogos" title={definition.label} description={`Agrega y administra valores de ${definition.label.toLowerCase()} sin modificar el código.`} actions={<Link href="/configuracion" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold hover:bg-lf-surface-muted"><ArrowLeft size={17} /> Volver</Link>} />

      {query.success ? <Alert variant="success" className="mb-5">{query.success}</Alert> : null}
      {query.error ? <Alert variant="danger" className="mb-5">{query.error}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil size={19} /> : <Plus size={19} />}{editing ? `Editar ${definition.singular}` : `Nueva ${definition.singular}`}</CardTitle></CardHeader>
          <CardContent>
            <form action={saveCatalogAction} className="space-y-4">
              <input type="hidden" name="catalogo" value={key} />
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <label className="block"><span className="mb-1.5 block text-sm font-medium">Nombre</span><input name="nombre" required minLength={2} maxLength={100} defaultValue={editing?.nombre ?? ""} className="h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" /></label>
              {(definition.fields as readonly CatalogField[]).map((field) => (
                <label key={field} className="block"><span className="mb-1.5 block text-sm font-medium">{fieldLabels[field]}</span>{field === "descripcion" ? <textarea name={field} rows={3} maxLength={500} defaultValue={editing?.[field] ?? ""} className="w-full rounded-xl border bg-white px-3.5 py-2.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" /> : <div className="flex items-center gap-2"><input name={field} required={key === "unidades" && field === "codigo"} maxLength={field === "codigo_hex" ? 7 : 20} placeholder={field === "codigo_hex" ? "#C96D4D" : undefined} defaultValue={editing?.[field] ?? ""} className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" />{field === "codigo_hex" && editing?.codigo_hex ? <span className="size-10 rounded-xl border" style={{ backgroundColor: editing.codigo_hex }} aria-label={`Muestra ${editing.codigo_hex}`} /> : null}</div>}</label>
              ))}
              <div className="flex gap-2"><button type="submit" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Save size={17} /> {editing ? "Guardar cambios" : "Crear registro"}</button>{editing ? <Link href={`/configuracion/catalogos/${key}`} className="inline-flex h-11 items-center rounded-xl border px-3 text-sm font-semibold hover:bg-lf-surface-muted">Cancelar</Link> : null}</div>
            </form>
          </CardContent>
        </Card>

        <div>
          {items.length ? <><TableContainer><Table><thead><tr><TableHead>Nombre</TableHead><TableHead>Detalle</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></tr></thead><tbody>{items.map((item) => (
            <tr key={item.id} className="hover:bg-lf-surface-muted/60">
              <TableCell className="font-semibold"><span className="flex items-center gap-2">{item.codigo_hex ? <span className="size-5 rounded-full border" style={{ backgroundColor: item.codigo_hex }} /> : null}{item.nombre}</span></TableCell>
              <TableCell className="text-sm text-lf-muted">{item.codigo || item.codigo_hex || item.descripcion || "—"}</TableCell>
              <TableCell><Badge variant={item.activo ? "success" : "neutral"}>{item.activo ? "Activo" : "Inactivo"}</Badge></TableCell>
              <TableCell><div className="flex justify-end gap-1"><Link href={`/configuracion/catalogos/${key}?editar=${item.id}`} className="grid size-9 place-items-center rounded-lg text-lf-muted hover:bg-lf-surface-muted hover:text-lf-terracotta" aria-label={`Editar ${item.nombre}`}><Pencil size={16} /></Link><form action={setCatalogStatusAction}><input type="hidden" name="catalogo" value={key} /><input type="hidden" name="id" value={item.id} /><input type="hidden" name="activo" value={String(!item.activo)} /><button type="submit" className="grid size-9 place-items-center rounded-lg text-lf-muted hover:bg-lf-surface-muted" aria-label={item.activo ? `Desactivar ${item.nombre}` : `Activar ${item.nombre}`}>{item.activo ? <CircleOff size={16} /> : <CheckCircle2 size={16} />}</button></form><DeleteCatalogButton catalog={key} id={item.id} name={item.nombre} /></div></TableCell>
            </tr>
          ))}</tbody></Table></TableContainer><p className="mt-3 text-sm text-lf-muted">{items.length} registro(s).</p></> : <Card><CardContent className="grid min-h-52 place-items-center text-center"><div><Plus className="mx-auto text-lf-terracotta" /><p className="mt-3 font-semibold">Catálogo vacío</p><p className="mt-1 text-sm text-lf-muted">Crea el primer registro usando el formulario.</p></div></CardContent></Card>}
        </div>
      </div>
    </ContentContainer>
  );
}
