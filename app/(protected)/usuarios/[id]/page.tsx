import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Alert, Badge, Card, CardContent } from "@/src/components/ui";
import { UserAdminActions } from "@/src/components/users/user-admin-actions";
import { getUserById, getUserCatalogs } from "@/src/services/users/users";

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function UserDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; reset?: string; status?: string; error?: string }>;
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const [user, catalogs] = await Promise.all([getUserById(id), getUserCatalogs()]);
  if (!user) notFound();

  const profile = catalogs.profiles.find((item) => item.id_perfil === user.id_perfil)?.nombre ?? "Sin perfil";
  const location = catalogs.locations.find((item) => item.id_local === user.id_local)?.nombre ?? "Sin local";
  const successMessage = feedback.created ? "Usuario creado correctamente. La contraseña temporal es su cédula." : feedback.updated ? "Usuario actualizado correctamente." : feedback.reset ? "La contraseña temporal fue restablecida a la cédula del usuario." : feedback.status ? "Estado actualizado correctamente." : null;
  const errorMessage = feedback.error === "accion-propia" ? "No puede bloquear o desactivar su propia cuenta." : feedback.error ? "No fue posible completar la operación." : null;

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Usuarios"
        title={`${user.nombres} ${user.apellidos}`}
        description={`${profile} · ${location}`}
        actions={<><Link href="/usuarios" className="inline-flex h-11 items-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold hover:bg-lf-surface-muted"><ArrowLeft size={17} /> Volver</Link><Link href={`/usuarios/${user.id_usuario}/editar`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover"><Pencil size={17} /> Editar</Link></>}
      />

      {successMessage ? <Alert variant="success" className="mb-5">{successMessage}</Alert> : null}
      {errorMessage ? <Alert variant="danger" className="mb-5">{errorMessage}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <Card><CardContent className="grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-2 sm:pt-6">
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Cédula</p><p className="mt-1 font-semibold">{user.cedula}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Correo</p><p className="mt-1 font-semibold">{user.correo}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Teléfono</p><p className="mt-1 font-semibold">{user.telefono ?? "No registrado"}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Perfil</p><p className="mt-1 font-semibold">{profile}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Local</p><p className="mt-1 font-semibold">{location}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-lf-muted">Último acceso</p><p className="mt-1 font-semibold">{formatDate(user.ultimo_acceso)}</p></div>
          <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-lf-muted">Estado</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant={user.activo ? "success" : "neutral"}>{user.activo ? "Activo" : "Inactivo"}</Badge><Badge variant={user.bloqueado ? "danger" : "success"}>{user.bloqueado ? "Bloqueado" : "Sin bloqueo"}</Badge><Badge variant={user.debe_cambiar_password ? "warning" : "info"}>{user.debe_cambiar_password ? "Cambio de contraseña pendiente" : "Contraseña actualizada"}</Badge><Badge>{user.intentos_fallidos} intento(s) fallido(s)</Badge></div></div>
        </CardContent></Card>

        <Card><CardContent className="pt-5 sm:pt-6"><h2 className="font-semibold">Acciones administrativas</h2><p className="mt-2 text-sm leading-6 text-lf-muted">Los cambios de estado invalidan el acceso en la siguiente verificación de sesión.</p><div className="mt-5"><UserAdminActions id={user.id_usuario} active={user.activo} blocked={user.bloqueado} /></div></CardContent></Card>
      </div>
    </ContentContainer>
  );
}
