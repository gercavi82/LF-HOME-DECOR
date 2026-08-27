import {
  ArrowRight,
  Boxes,
  Palette,
  Ruler,
  Shapes,
  Tags,
  Truck,
  Store,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Card, CardContent } from "@/src/components/ui";
import { requirePermission } from "@/src/services/auth/authorization";
import { catalogDefinitions, type CatalogKey } from "@/src/services/catalogs/catalogs";

const icons: Record<CatalogKey, typeof Tags> = {
  proveedores: Truck,
  locales: Store,
  bodegas: Warehouse,
  categorias: Tags,
  marcas: Boxes,
  tipos: Shapes,
  materiales: Boxes,
  tamanos: Ruler,
  colores: Palette,
  disenos: Shapes,
  unidades: Ruler,
};

export default async function SettingsPage() {
  await requirePermission("CONFIGURACION_VER");

  const operationsCatalogs: CatalogKey[] = ["proveedores", "locales", "bodegas"];
  const productCatalogs: CatalogKey[] = [
    "categorias",
    "tipos",
    "marcas",
    "materiales",
    "tamanos",
    "colores",
    "disenos",
    "unidades",
  ];

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Gestiona los catálogos de sedes operativas, proveedores, productos e inventario."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-lf-navy">
          Sedes Operativas & Proveedores
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {operationsCatalogs.map((key) => {
            const catalog = catalogDefinitions[key];
            const Icon = icons[key];
            return (
              <Link key={key} href={`/configuracion/catalogos/${key}`} className="group">
                <Card className="h-full border-l-4 border-l-lf-terracotta transition hover:-translate-y-0.5 hover:shadow-[var(--lf-shadow-md)]">
                  <CardContent className="pt-5 sm:pt-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-lf-terracotta/10 text-lf-terracotta">
                      <Icon size={21} />
                    </span>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-lf-navy">{catalog.label}</h3>
                        <p className="mt-1 text-xs text-lf-muted">
                          {key === "bodegas"
                            ? "Administrar bodegas vinculadas a locales"
                            : key === "locales"
                            ? "Administrar sucursales y puntos de venta"
                            : "Administrar datos de proveedores y compras"}
                        </p>
                      </div>
                      <ArrowRight
                        size={18}
                        className="text-lf-muted transition group-hover:translate-x-1 group-hover:text-lf-terracotta"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-lf-navy">
          Catálogos de Productos e Inventario
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {productCatalogs.map((key) => {
            const catalog = catalogDefinitions[key];
            const Icon = icons[key];
            return (
              <Link key={key} href={`/configuracion/catalogos/${key}`} className="group">
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-[var(--lf-shadow-md)]">
                  <CardContent className="pt-5 sm:pt-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-lf-navy/5 text-lf-navy">
                      <Icon size={21} />
                    </span>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-lf-navy">{catalog.label}</h3>
                        <p className="mt-1 text-xs text-lf-muted">Administrar registros</p>
                      </div>
                      <ArrowRight
                        size={18}
                        className="text-lf-muted transition group-hover:translate-x-1 group-hover:text-lf-terracotta"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </ContentContainer>
  );
}
