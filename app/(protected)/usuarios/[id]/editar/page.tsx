import { notFound } from "next/navigation";

import { ContentContainer, PageHeader } from "@/src/components/layout";
import { UserForm } from "@/src/components/users/user-form";
import { requirePermission } from "@/src/services/auth/authorization";
import { getUserById, getUserCatalogs } from "@/src/services/users/users";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("USUARIO_EDITAR");
  const { id } = await params;
  const [user, catalogs] = await Promise.all([getUserById(id), getUserCatalogs()]);
  if (!user) notFound();

  return (
    <ContentContainer className="max-w-4xl">
      <PageHeader eyebrow="Usuarios" title="Editar usuario" description="Actualiza la información operativa, perfil y local asignado." />
      <UserForm user={user} profiles={catalogs.profiles.map((item) => ({ id: item.id_perfil, name: item.nombre }))} locations={catalogs.locations.map((item) => ({ id: item.id_local, name: item.nombre }))} />
    </ContentContainer>
  );
}
