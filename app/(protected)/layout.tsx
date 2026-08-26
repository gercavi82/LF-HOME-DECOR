import type { ReactNode } from "react";

import { AppShell } from "@/src/components/layout";
import { getAlertCount } from "@/src/services/alerts/alerts";
import { requireAuthContext } from "@/src/services/auth/authorization";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await requireAuthContext();
  const initials = `${context.nombres.at(0) ?? ""}${context.apellidos.at(0) ?? ""}`.toUpperCase();
  const canViewAlerts = context.permisos.some((permission) => permission.codigo === "INVENTARIO_VER");
  const alertCount = canViewAlerts ? await getAlertCount() : 0;

  return (
    <AppShell
      user={{
        name: `${context.nombres} ${context.apellidos}`.trim(),
        profile: context.perfil,
        initials,
      }}
      permissionCodes={context.permisos.map((permission) => permission.codigo)}
      alertCount={alertCount}
    >
      {children}
    </AppShell>
  );
}
