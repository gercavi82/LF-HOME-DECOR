import { redirect } from "next/navigation";
import { ModulePlaceholder } from "@/src/components/layout";
import { requireAuth } from "@/src/services/auth/authorization";

export default async function ReportsPage() {
  const context = await requireAuth();
  const canView = context.permisos.some((p) =>
    ["FINANZAS_VER", "REPORTES_VER", "DASHBOARD_VER"].includes(p.codigo)
  );

  if (!canView) {
    redirect("/sin-permiso");
  }

  return (
    <ModulePlaceholder
      title="Reportes"
      description="Indicadores comerciales, inventario y finanzas."
    />
  );
}
