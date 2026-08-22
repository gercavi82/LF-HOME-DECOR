import { Pencil, Plus, Search, UsersRound } from "lucide-react";
import Link from "next/link";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { Badge, EmptyState, Table, TableCell, TableContainer, TableHead } from "@/src/components/ui";
import { listUsers } from "@/src/services/users/users";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { users, count } = await listUsers(q);

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Gestiona accesos, perfiles, locales y estados del personal."
        actions={
          <Link href="/usuarios/nuevo" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-lf-terracotta-hover">
            <Plus size={18} aria-hidden="true" /> Nuevo usuario
          </Link>
        }
      />

      <form method="get" className="mb-5 flex flex-col gap-3 rounded-2xl border bg-lf-surface p-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar usuarios</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" aria-hidden="true" />
          <input name="q" defaultValue={q} placeholder="Buscar por cédula, nombre o correo..." className="h-11 w-full rounded-xl border bg-white pl-10 pr-4 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20" />
        </label>
        <button type="submit" className="h-11 rounded-xl bg-lf-navy px-5 text-sm font-semibold text-white hover:bg-lf-navy-soft">Buscar</button>
        {q ? <Link href="/usuarios" className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold hover:bg-lf-surface-muted">Limpiar</Link> : null}
      </form>

      {users.length ? (
        <>
          <TableContainer>
            <Table>
              <thead><tr><TableHead>Cédula</TableHead><TableHead>Usuario</TableHead><TableHead>Perfil / Local</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id_usuario} className="transition hover:bg-lf-surface-muted/60">
                    <TableCell className="font-mono text-xs">{user.cedula}</TableCell>
                    <TableCell><p className="font-semibold">{user.nombres} {user.apellidos}</p><p className="mt-0.5 text-xs text-lf-muted">{user.correo}</p></TableCell>
                    <TableCell><p>{user.perfil}</p><p className="mt-0.5 text-xs text-lf-muted">{user.local}</p></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1.5"><Badge variant={user.activo ? "success" : "neutral"}>{user.activo ? "Activo" : "Inactivo"}</Badge>{user.bloqueado ? <Badge variant="danger">Bloqueado</Badge> : null}{user.debe_cambiar_password ? <Badge variant="warning">Cambio pendiente</Badge> : null}</div></TableCell>
                    <TableCell className="text-right"><Link href={`/usuarios/${user.id_usuario}`} aria-label={`Editar a ${user.nombres} ${user.apellidos}`} className="inline-flex size-9 items-center justify-center rounded-lg text-lf-muted hover:bg-lf-surface-muted hover:text-lf-terracotta"><Pencil size={17} aria-hidden="true" /></Link></TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
          <p className="mt-3 text-sm text-lf-muted">{count} usuario(s) encontrado(s). Se muestran hasta 50 registros.</p>
        </>
      ) : (
        <EmptyState title="No se encontraron usuarios" description={q ? "Prueba con otra cédula, nombre o correo." : "Crea el primer usuario para comenzar."} action={<Link href="/usuarios/nuevo" className="inline-flex items-center gap-2 font-semibold text-lf-terracotta"><UsersRound size={18} /> Crear usuario</Link>} />
      )}
    </ContentContainer>
  );
}
