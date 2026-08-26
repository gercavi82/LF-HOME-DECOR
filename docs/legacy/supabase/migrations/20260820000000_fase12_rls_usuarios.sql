-- Fase 12: RLS base para public.usuarios.
-- La tabla se mantiene cerrada para anon y para escrituras directas del cliente.

create schema if not exists private;

create or replace function private.es_administrador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.perfiles p on p.id_perfil = u.id_perfil
    where u.auth_user_id = auth.uid()
      and u.activo = true
      and u.bloqueado = false
      and lower(p.nombre) = lower('Administrador')
  );
$$;

revoke all on function private.es_administrador() from public;
grant execute on function private.es_administrador() to authenticated;

alter table public.usuarios enable row level security;

drop policy if exists usuarios_select_propio_o_admin on public.usuarios;
create policy usuarios_select_propio_o_admin
on public.usuarios
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or private.es_administrador()
);

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin
on public.usuarios
for update
to authenticated
using (private.es_administrador())
with check (private.es_administrador());

drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin
on public.usuarios
for insert
to authenticated
with check (private.es_administrador());

drop policy if exists usuarios_delete_admin on public.usuarios;
create policy usuarios_delete_admin
on public.usuarios
for delete
to authenticated
using (private.es_administrador());

revoke all on table public.usuarios from anon;