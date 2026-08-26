import { ContentContainer, PageHeader } from "@/src/components/layout";
import { UserForm } from "@/src/components/users/user-form";
import { requirePermission } from "@/src/services/auth/authorization";
import { getUserCatalogs } from "@/src/services/users/users";

export default async function NewUserPage() {
  await requirePermission("USUARIO_CREAR");
  const catalogs = await getUserCatalogs();

  return (
    <ContentContainer className="max-w-4xl">
      <PageHeader eyebrow="Usuarios" title="Nuevo usuario" description="La cuenta se creará con la cédula como contraseña temporal de acceso." />
      <UserForm
        profiles={catalogs.profiles.map((item) => ({ id: item.id_perfil, name: item.nombre }))}
        locations={catalogs.locations.map((item) => ({ id: item.id_local, name: item.nombre }))}
      />
    </ContentContainer>
  );
}
