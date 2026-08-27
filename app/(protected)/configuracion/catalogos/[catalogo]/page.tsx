import { ArrowLeft, CheckCircle2, CircleOff, Pencil, Plus, Save } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveCatalogAction, setCatalogStatusAction } from "@/app/(protected)/configuracion/catalogos/actions";
import { DeleteCatalogButton } from "@/src/components/catalogs/delete-catalog-button";
import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import {
  catalogDefinitions,
  listCatalogItems,
  listLocalesOptions,
  parseCatalogKey,
  type CatalogField,
} from "@/src/services/catalogs/catalogs";

const fieldLabels: Record<CatalogField, string> = {
  codigo: "Código interno / Sigla",
  descripcion: "Descripción / Notas",
  codigo_hex: "Color hexadecimal",
  ruc_cedula: "RUC / Cédula",
  identificacion: "Cédula / RUC",
  razon_social: "Razón Social (Opcional)",
  telefono: "Teléfono / Celular",
  correo: "Correo Electrónico",
  direccion: "Dirección física",
  id_local: "Local Comercial asignado",
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
  const locales = key === "bodegas" ? await listLocalesOptions() : [];

  const editingId = Number(query.editar);
  const editing = Number.isInteger(editingId) ? items.find((item) => item.id === editingId) : undefined;

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Configuración · Catálogos"
        title={definition.label}
        description={`Agrega y administra valores de ${definition.label.toLowerCase()} sin modificar el código.`}
        actions={
          <Link
            href="/configuracion"
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold hover:bg-lf-surface-muted"
          >
            <ArrowLeft size={17} /> Volver
          </Link>
        }
      />

      {query.success ? <Alert variant="success" className="mb-5">{query.success}</Alert> : null}
      {query.error ? <Alert variant="danger" className="mb-5">{query.error}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lf-navy">
              {editing ? <Pencil size={19} /> : <Plus size={19} />}
              {editing ? `Editar ${definition.singular}` : `Nuevo/a ${definition.singular}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveCatalogAction} className="space-y-4">
              <input type="hidden" name="catalogo" value={key} />
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  {key === "proveedores"
                    ? "Razón Social / Nombre"
                    : key === "clientes"
                    ? "Nombres Completos / Contacto"
                    : "Nombre"}
                </span>
                <input
                  name="nombre"
                  required
                  minLength={2}
                  maxLength={150}
                  defaultValue={editing?.nombre ?? ""}
                  placeholder={
                    key === "proveedores"
                      ? "Ej. Distribuidora Textil S.A."
                      : key === "clientes"
                      ? "Ej. Juan Pérez"
                      : key === "bodegas"
                      ? "Ej. Bodega Principal Matriz"
                      : undefined
                  }
                  className="h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"
                />
              </label>

              {(definition.fields as readonly CatalogField[]).map((field) => {
                if (field === "id_local") {
                  return (
                    <label key={field} className="block">
                      <span className="mb-1.5 block text-sm font-medium">Local Comercial asignado</span>
                      <select
                        name="id_local"
                        required
                        defaultValue={editing?.id_local ?? locales[0]?.id_local ?? ""}
                        className="h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"
                      >
                        <option value="" disabled>Seleccione un local</option>
                        {locales.map((loc) => (
                          <option key={loc.id_local} value={loc.id_local}>
                            {loc.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field === "descripcion") {
                  return (
                    <label key={field} className="block">
                      <span className="mb-1.5 block text-sm font-medium">{fieldLabels[field]}</span>
                      <textarea
                        name={field}
                        rows={3}
                        maxLength={500}
                        defaultValue={editing?.[field] ?? ""}
                        placeholder="Detalles o notas opcionales..."
                        className="w-full rounded-xl border bg-white px-3.5 py-2.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"
                      />
                    </label>
                  );
                }

                return (
                  <label key={field} className="block">
                    <span className="mb-1.5 block text-sm font-medium">{fieldLabels[field]}</span>
                    <div className="flex items-center gap-2">
                      <input
                        name={field}
                        type={field === "correo" ? "email" : "text"}
                        required={
                          (key === "unidades" && field === "codigo") ||
                          (key === "proveedores" && field === "ruc_cedula") ||
                          (key === "clientes" && field === "identificacion")
                        }
                        maxLength={field === "codigo_hex" ? 7 : field === "direccion" ? 255 : 50}
                        placeholder={
                          field === "codigo_hex"
                            ? "#C96D4D"
                            : field === "ruc_cedula" || field === "identificacion"
                            ? "1712345678 o 1790012345001"
                            : field === "telefono"
                            ? "0991234567"
                            : field === "correo"
                            ? "cliente@correo.com"
                            : field === "razon_social"
                            ? "Comercializadora Ejemplo Cía. Ltda."
                            : undefined
                        }
                        defaultValue={editing?.[field] ?? ""}
                        className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"
                      />
                      {field === "codigo_hex" && editing?.codigo_hex ? (
                        <span
                          className="size-10 rounded-xl border"
                          style={{ backgroundColor: editing.codigo_hex }}
                          aria-label={`Muestra ${editing.codigo_hex}`}
                        />
                      ) : null}
                    </div>
                  </label>
                );
              })}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"
                >
                  <Save size={17} /> {editing ? "Guardar cambios" : "Crear registro"}
                </button>
                {editing ? (
                  <Link
                    href={`/configuracion/catalogos/${key}`}
                    className="inline-flex h-11 items-center rounded-xl border px-3 text-sm font-semibold hover:bg-lf-surface-muted"
                  >
                    Cancelar
                  </Link>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div>
          {items.length ? (
            <>
              <TableContainer>
                <Table>
                  <thead>
                    <tr>
                      <TableHead>Nombre</TableHead>
                      <TableHead>
                        {key === "bodegas"
                          ? "Local Asignado"
                          : key === "proveedores"
                          ? "RUC / Cédula"
                          : key === "clientes"
                          ? "Cédula / RUC"
                          : "Detalle"}
                      </TableHead>
                      {key === "proveedores" || key === "locales" || key === "bodegas" || key === "clientes" ? (
                        <TableHead>Contacto / Ubicación</TableHead>
                      ) : null}
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-lf-surface-muted/60">
                        <TableCell className="font-semibold text-lf-navy">
                          <span className="flex items-center gap-2">
                            {item.codigo_hex ? (
                              <span
                                className="size-5 rounded-full border shadow-2xs"
                                style={{ backgroundColor: item.codigo_hex }}
                              />
                            ) : null}
                            {item.nombre}
                          </span>
                        </TableCell>
                        
                        <TableCell className="text-sm">
                          {key === "bodegas" ? (
                            <Badge variant="neutral">{item.local_nombre || "—"}</Badge>
                          ) : key === "proveedores" ? (
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {item.ruc_cedula || "—"}
                            </span>
                          ) : key === "clientes" ? (
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {item.identificacion || "—"}
                            </span>
                          ) : (
                            <span className="text-lf-muted">
                              {item.codigo || item.codigo_hex || item.descripcion || "—"}
                            </span>
                          )}
                        </TableCell>

                        {key === "proveedores" || key === "locales" || key === "bodegas" || key === "clientes" ? (
                          <TableCell className="text-xs text-lf-muted">
                            {key === "bodegas" ? (
                              item.descripcion || "—"
                            ) : (
                              <div className="space-y-0.5">
                                {item.razon_social ? <div className="font-semibold text-slate-800">🏢 {item.razon_social}</div> : null}
                                {item.telefono ? <div>📞 {item.telefono}</div> : null}
                                {item.direccion ? <div>📍 {item.direccion}</div> : null}
                                {!item.telefono && !item.correo && !item.direccion && !item.razon_social ? "—" : null}
                              </div>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Badge variant={item.activo ? "success" : "neutral"}>
                            {item.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/configuracion/catalogos/${key}?editar=${item.id}`}
                              className="grid size-9 place-items-center rounded-lg text-lf-muted hover:bg-lf-surface-muted hover:text-lf-terracotta"
                              aria-label={`Editar ${item.nombre}`}
                            >
                              <Pencil size={16} />
                            </Link>
                            <form action={setCatalogStatusAction}>
                              <input type="hidden" name="catalogo" value={key} />
                              <input type="hidden" name="id" value={item.id} />
                              <input type="hidden" name="activo" value={String(!item.activo)} />
                              <button
                                type="submit"
                                className="grid size-9 place-items-center rounded-lg text-lf-muted hover:bg-lf-surface-muted"
                                aria-label={item.activo ? `Desactivar ${item.nombre}` : `Activar ${item.nombre}`}
                              >
                                {item.activo ? <CircleOff size={16} /> : <CheckCircle2 size={16} />}
                              </button>
                            </form>
                            <DeleteCatalogButton catalog={key} id={item.id} name={item.nombre} />
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
              <p className="mt-3 text-sm text-lf-muted">{items.length} registro(s) encontrados.</p>
            </>
          ) : (
            <Card>
              <CardContent className="grid min-h-52 place-items-center text-center">
                <div>
                  <Plus className="mx-auto text-lf-terracotta" />
                  <p className="mt-3 font-semibold text-lf-navy">Catálogo vacío</p>
                  <p className="mt-1 text-sm text-lf-muted">Crea el primer registro usando el formulario.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ContentContainer>
  );
}
