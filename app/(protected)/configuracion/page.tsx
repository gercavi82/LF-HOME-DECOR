import { ArrowRight, Boxes, Palette, Ruler, Shapes, Tags } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Card, CardContent } from "@/src/components/ui";
import { requireAuthContext, ROLE_NAMES } from "@/src/services/auth/authorization";
import { catalogDefinitions } from "@/src/services/catalogs/catalogs";

const icons = { categorias: Tags, marcas: Boxes, tipos: Shapes, materiales: Boxes, tamanos: Ruler, colores: Palette, disenos: Shapes, unidades: Ruler };

export default async function SettingsPage() {
  const context = await requireAuthContext();
  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR) redirect("/sin-permiso");
  return (
    <ContentContainer>
      <PageHeader eyebrow="Administración" title="Configuración" description="Gestiona los catálogos utilizados por productos e inventario." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(catalogDefinitions).map(([key, catalog]) => {
          const Icon = icons[key as keyof typeof icons];
          return <Link key={key} href={`/configuracion/catalogos/${key}`} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-[var(--lf-shadow-md)]"><CardContent className="pt-5 sm:pt-5"><span className="grid size-11 place-items-center rounded-xl bg-lf-terracotta/10 text-lf-terracotta"><Icon size={21} /></span><div className="mt-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">{catalog.label}</h2><p className="mt-1 text-sm text-lf-muted">Administrar registros</p></div><ArrowRight size={18} className="text-lf-muted transition group-hover:translate-x-1 group-hover:text-lf-terracotta" /></div></CardContent></Card></Link>;
        })}
      </div>
    </ContentContainer>
  );
}
