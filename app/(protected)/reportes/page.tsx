import { ModulePlaceholder } from "@/src/components/layout";
import { requirePermission } from "@/src/services/auth/authorization";

export default async function ReportsPage() {
  await requirePermission("FINANZAS_VER");
  return <ModulePlaceholder title="Reportes" description="Indicadores comerciales, inventario y finanzas." />;
}
