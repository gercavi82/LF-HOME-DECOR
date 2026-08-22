-- El cliente administrativo server-side necesita privilegios de tabla.
-- service_role omite RLS, pero PostgreSQL sigue exigiendo los GRANT base.

grant usage on schema public to service_role;
grant select, insert, update on table public.usuarios to service_role;
grant select on table public.perfiles to service_role;
grant select on table public.perfil_permisos to service_role;
grant select on table public.permisos to service_role;
grant select on table public.locales to service_role;

-- Los UPDATE de usuarios ejecutan el trigger de auditoria.
grant insert on table public.auditoria to service_role;
grant usage, select on sequence public.auditoria_id_auditoria_seq to service_role;

-- La resolucion por cedula debe permanecer inaccesible para anon.
revoke all on table public.usuarios from anon;
