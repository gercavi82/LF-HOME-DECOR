"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { createUserAction, updateUserAction, type UserActionState } from "@/app/(protected)/usuarios/actions";
import { Alert, Button, Card, CardContent, Input, Spinner } from "@/src/components/ui";
import { createUserFormSchema, type CreateUserFormInput } from "@/src/lib/validation/users";

type CatalogOption = { id: number; name: string };
type EditableUser = { id_usuario: number; cedula: string; nombres: string; apellidos: string; correo: string; telefono: string | null; id_perfil: number; id_local: number | null };
const initialState: UserActionState = {};

export function UserForm({ profiles, locations, user }: { profiles: CatalogOption[]; locations: CatalogOption[]; user?: EditableUser }) {
  const action = user ? updateUserAction : createUserAction;
  const [state, formAction, serverPending] = useActionState(action, initialState);
  const [clientPending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserFormSchema), mode: "onBlur",
    defaultValues: { cedula: user?.cedula ?? "", correo: user?.correo ?? "", nombres: user?.nombres ?? "", apellidos: user?.apellidos ?? "", telefono: user?.telefono ?? "", id_perfil: user?.id_perfil ?? "", id_local: user?.id_local ?? "" },
  });
  const pending = serverPending || clientPending;
  const submit = handleSubmit((values) => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(values)) formData.set(field, String(value ?? ""));
    if (user) formData.set("id_usuario", String(user.id_usuario));
    startTransition(() => formAction(formData));
  });
  const errorFor = (name: keyof CreateUserFormInput) => errors[name]?.message?.toString() ?? state.fieldErrors?.[name];

  return <form onSubmit={submit} className="space-y-6" noValidate>
    {user ? <input type="hidden" name="id_usuario" value={user.id_usuario} /> : null}
    <Card><CardContent className="grid gap-5 pt-5 sm:grid-cols-2 sm:pt-6">
      <Input {...register("cedula")} label="Cédula" inputMode="numeric" maxLength={10} disabled={Boolean(user) || pending} error={errorFor("cedula")} hint={user ? "La cédula identifica el acceso y no puede modificarse." : "Será también la contraseña temporal inicial."} />
      <Input {...register("correo")} label="Correo" type="email" autoComplete="email" disabled={Boolean(user) || pending} error={errorFor("correo")} hint={user ? "El correo está sincronizado con Supabase Auth." : "Recibirá comunicaciones de acceso y recuperación."} />
      <Input {...register("nombres")} label="Nombres" autoComplete="given-name" disabled={pending} error={errorFor("nombres")} />
      <Input {...register("apellidos")} label="Apellidos" autoComplete="family-name" disabled={pending} error={errorFor("apellidos")} />
      <Input {...register("telefono")} label="Teléfono (opcional)" type="tel" autoComplete="tel" maxLength={20} disabled={pending} error={errorFor("telefono")} />
      <label className="block space-y-2 text-sm font-medium"><span>Perfil</span><select {...register("id_perfil")} disabled={pending} aria-invalid={Boolean(errorFor("id_perfil"))} className="h-11 w-full rounded-xl border bg-lf-surface px-3.5 outline-none focus:border-lf-terracotta disabled:bg-lf-surface-muted"><option value="">Seleccione un perfil</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>{errorFor("id_perfil") ? <span className="block text-xs text-lf-danger">{errorFor("id_perfil")}</span> : null}</label>
      <label className="block space-y-2 text-sm font-medium sm:col-span-2"><span>Local</span><select {...register("id_local")} disabled={pending} aria-invalid={Boolean(errorFor("id_local"))} className="h-11 w-full rounded-xl border bg-lf-surface px-3.5 outline-none focus:border-lf-terracotta disabled:bg-lf-surface-muted"><option value="">Seleccione un local</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>{errorFor("id_local") ? <span className="block text-xs text-lf-danger">{errorFor("id_local")}</span> : null}</label>
    </CardContent></Card>
    {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href={user ? `/usuarios/${user.id_usuario}` : "/usuarios"} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border bg-lf-surface px-4 text-sm font-semibold"><ArrowLeft size={17} /> Cancelar</Link><Button type="submit" disabled={pending}>{pending ? <Spinner label="Guardando..." /> : user ? <><Save size={17} /> Guardar cambios</> : <><UserPlus size={17} /> Crear usuario</>}</Button></div>
  </form>;
}
