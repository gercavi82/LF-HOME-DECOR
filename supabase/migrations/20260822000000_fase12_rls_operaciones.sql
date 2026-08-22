-- Fase 12: RLS para productos, inventario, ventas y auditoria.
-- Las decisiones se basan en el usuario Auth activo y en permisos persistidos.

create schema if not exists private;

create or replace function private.usuario_actual_id()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select u.id_usuario
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.activo = true
    and u.bloqueado = false
  limit 1;
$$;

create or replace function private.usuario_actual_local_id()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select u.id_local
  from public.usuarios u
  where u.auth_user_id = auth.uid()
    and u.activo = true
    and u.bloqueado = false
  limit 1;
$$;

create or replace function private.usuario_actual_perfil_codigo()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.codigo
  from public.usuarios u
  join public.perfiles p on p.id_perfil = u.id_perfil
  where u.auth_user_id = auth.uid()
    and u.activo = true
    and u.bloqueado = false
    and p.activo = true
  limit 1;
$$;

create or replace function private.tiene_permiso(p_codigo text)
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
    join public.perfil_permisos pp on pp.id_perfil = p.id_perfil
    join public.permisos pe on pe.id_permiso = pp.id_permiso
    where u.auth_user_id = auth.uid()
      and u.activo = true
      and u.bloqueado = false
      and p.activo = true
      and pe.activo = true
      and pe.codigo = p_codigo
  );
$$;

create or replace function private.es_administrador()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(private.usuario_actual_perfil_codigo() = 'ADMINISTRADOR', false);
$$;

revoke all on function private.usuario_actual_id() from public;
revoke all on function private.usuario_actual_local_id() from public;
revoke all on function private.usuario_actual_perfil_codigo() from public;
revoke all on function private.tiene_permiso(text) from public;
revoke all on function private.es_administrador() from public;

grant execute on function private.usuario_actual_id() to authenticated;
grant execute on function private.usuario_actual_local_id() to authenticated;
grant execute on function private.usuario_actual_perfil_codigo() to authenticated;
grant execute on function private.tiene_permiso(text) to authenticated;
grant execute on function private.es_administrador() to authenticated;

-- PRODUCTOS Y VARIANTES

alter table public.productos enable row level security;
alter table public.variantes_producto enable row level security;

drop policy if exists productos_select_autorizado on public.productos;
create policy productos_select_autorizado
on public.productos for select to authenticated
using (private.tiene_permiso('PRODUCTO_VER'));

drop policy if exists productos_insert_autorizado on public.productos;
create policy productos_insert_autorizado
on public.productos for insert to authenticated
with check (
  private.tiene_permiso('PRODUCTO_CREAR')
  and creado_por = private.usuario_actual_id()
);

drop policy if exists productos_update_autorizado on public.productos;
create policy productos_update_autorizado
on public.productos for update to authenticated
using (private.tiene_permiso('PRODUCTO_EDITAR'))
with check (private.tiene_permiso('PRODUCTO_EDITAR'));

drop policy if exists productos_delete_admin on public.productos;
create policy productos_delete_admin
on public.productos for delete to authenticated
using (private.es_administrador());

drop policy if exists variantes_select_autorizado on public.variantes_producto;
create policy variantes_select_autorizado
on public.variantes_producto for select to authenticated
using (private.tiene_permiso('PRODUCTO_VER'));

drop policy if exists variantes_insert_autorizado on public.variantes_producto;
create policy variantes_insert_autorizado
on public.variantes_producto for insert to authenticated
with check (private.tiene_permiso('PRODUCTO_CREAR'));

drop policy if exists variantes_update_autorizado on public.variantes_producto;
create policy variantes_update_autorizado
on public.variantes_producto for update to authenticated
using (
  private.tiene_permiso('PRODUCTO_EDITAR')
  or private.tiene_permiso('PRODUCTO_PRECIO')
)
with check (
  private.tiene_permiso('PRODUCTO_EDITAR')
  or private.tiene_permiso('PRODUCTO_PRECIO')
);

drop policy if exists variantes_delete_admin on public.variantes_producto;
create policy variantes_delete_admin
on public.variantes_producto for delete to authenticated
using (private.es_administrador());

revoke all on table public.productos, public.variantes_producto from anon;
grant select, insert, update, delete
on table public.productos, public.variantes_producto to authenticated;

-- INVENTARIO: lectura autorizada; las escrituras directas quedan cerradas.

alter table public.stock_producto enable row level security;
alter table public.movimientos_inventario enable row level security;

drop policy if exists stock_select_autorizado on public.stock_producto;
create policy stock_select_autorizado
on public.stock_producto for select to authenticated
using (private.tiene_permiso('INVENTARIO_VER'));

drop policy if exists movimientos_inventario_select_autorizado
on public.movimientos_inventario;
create policy movimientos_inventario_select_autorizado
on public.movimientos_inventario for select to authenticated
using (private.tiene_permiso('INVENTARIO_VER'));

revoke all on table public.stock_producto, public.movimientos_inventario from anon;
revoke insert, update, delete
on table public.stock_producto, public.movimientos_inventario from authenticated;
grant select
on table public.stock_producto, public.movimientos_inventario to authenticated;

-- El procedimiento acepta p_usuario: sólo el servidor puede invocarlo.
do $$
declare
  procedure_signature regprocedure;
begin
  for procedure_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'sp_registrar_movimiento_inventario'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      procedure_signature
    );
    execute format(
      'grant execute on function %s to service_role',
      procedure_signature
    );
  end loop;
end;
$$;

-- VENTAS, DETALLES Y PAGOS

alter table public.ventas enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.pagos_venta enable row level security;

drop policy if exists ventas_select_autorizado on public.ventas;
create policy ventas_select_autorizado
on public.ventas for select to authenticated
using (
  private.es_administrador()
  or (
    private.usuario_actual_perfil_codigo() = 'VENTA_LOCAL'
    and private.tiene_permiso('VENTA_VER')
    and id_local = private.usuario_actual_local_id()
  )
  or (
    private.usuario_actual_perfil_codigo() = 'ASESOR'
    and private.tiene_permiso('VENTA_VER')
    and id_usuario = private.usuario_actual_id()
  )
);

drop policy if exists ventas_insert_autorizado on public.ventas;
create policy ventas_insert_autorizado
on public.ventas for insert to authenticated
with check (
  private.tiene_permiso('VENTA_CREAR')
  and id_usuario = private.usuario_actual_id()
  and (
    private.es_administrador()
    or id_local = private.usuario_actual_local_id()
  )
);

drop policy if exists ventas_update_anulacion on public.ventas;
create policy ventas_update_anulacion
on public.ventas for update to authenticated
using (private.tiene_permiso('VENTA_ANULAR'))
with check (private.tiene_permiso('VENTA_ANULAR'));

drop policy if exists ventas_delete_admin on public.ventas;
create policy ventas_delete_admin
on public.ventas for delete to authenticated
using (private.es_administrador());

drop policy if exists detalle_ventas_select_autorizado on public.detalle_ventas;
create policy detalle_ventas_select_autorizado
on public.detalle_ventas for select to authenticated
using (
  exists (
    select 1 from public.ventas v where v.id_venta = detalle_ventas.id_venta
  )
);

drop policy if exists detalle_ventas_insert_autorizado on public.detalle_ventas;
create policy detalle_ventas_insert_autorizado
on public.detalle_ventas for insert to authenticated
with check (
  private.tiene_permiso('VENTA_CREAR')
  and exists (
    select 1
    from public.ventas v
    where v.id_venta = detalle_ventas.id_venta
      and v.id_usuario = private.usuario_actual_id()
  )
);

drop policy if exists detalle_ventas_update_autorizado on public.detalle_ventas;
create policy detalle_ventas_update_autorizado
on public.detalle_ventas for update to authenticated
using (private.tiene_permiso('VENTA_ANULAR'))
with check (private.tiene_permiso('VENTA_ANULAR'));

drop policy if exists detalle_ventas_delete_autorizado on public.detalle_ventas;
create policy detalle_ventas_delete_autorizado
on public.detalle_ventas for delete to authenticated
using (private.tiene_permiso('VENTA_ANULAR'));

drop policy if exists pagos_venta_select_autorizado on public.pagos_venta;
create policy pagos_venta_select_autorizado
on public.pagos_venta for select to authenticated
using (
  exists (
    select 1 from public.ventas v where v.id_venta = pagos_venta.id_venta
  )
);

drop policy if exists pagos_venta_insert_autorizado on public.pagos_venta;
create policy pagos_venta_insert_autorizado
on public.pagos_venta for insert to authenticated
with check (
  private.tiene_permiso('VENTA_CREAR')
  and exists (
    select 1
    from public.ventas v
    where v.id_venta = pagos_venta.id_venta
      and v.id_usuario = private.usuario_actual_id()
  )
);

drop policy if exists pagos_venta_update_autorizado on public.pagos_venta;
create policy pagos_venta_update_autorizado
on public.pagos_venta for update to authenticated
using (private.tiene_permiso('VENTA_ANULAR'))
with check (private.tiene_permiso('VENTA_ANULAR'));

drop policy if exists pagos_venta_delete_autorizado on public.pagos_venta;
create policy pagos_venta_delete_autorizado
on public.pagos_venta for delete to authenticated
using (private.tiene_permiso('VENTA_ANULAR'));

revoke all on table public.ventas, public.detalle_ventas, public.pagos_venta
from anon;
grant select, insert, update, delete
on table public.ventas, public.detalle_ventas, public.pagos_venta
to authenticated;

-- AUDITORIA: sólo lectura explícitamente autorizada; escritura por triggers.

alter table public.auditoria enable row level security;

drop policy if exists auditoria_select_autorizado on public.auditoria;
create policy auditoria_select_autorizado
on public.auditoria for select to authenticated
using (private.tiene_permiso('AUDITORIA_VER'));

revoke all on table public.auditoria from anon;
revoke insert, update, delete on table public.auditoria from authenticated;
grant select on table public.auditoria to authenticated;

-- El trigger escribe como su propietario; el cliente sigue sin INSERT directo.
alter function public.fn_auditoria() security definer;
alter function public.fn_auditoria() set search_path = public, pg_temp;

-- Las vistas deben respetar las policies de las tablas subyacentes.
alter view public.vw_dashboard_ventas set (security_invoker = true);
alter view public.vw_inventario_actual set (security_invoker = true);
alter view public.vw_productos_bajo_stock set (security_invoker = true);
alter view public.vw_productos_agotados set (security_invoker = true);

revoke all on table
  public.vw_dashboard_ventas,
  public.vw_inventario_actual,
  public.vw_productos_bajo_stock,
  public.vw_productos_agotados
from anon;

grant select on table
  public.vw_dashboard_ventas,
  public.vw_inventario_actual,
  public.vw_productos_bajo_stock,
  public.vw_productos_agotados
to authenticated;

-- Catálogos requeridos por las vistas de producto e inventario.
grant select on table
  public.bodegas,
  public.categorias,
  public.marcas,
  public.materiales,
  public.tamanos,
  public.colores,
  public.disenos,
  public.tipos_producto,
  public.unidades_medida
to authenticated;

revoke all on table
  public.bodegas,
  public.categorias,
  public.marcas,
  public.materiales,
  public.tamanos,
  public.colores,
  public.disenos,
  public.tipos_producto,
  public.unidades_medida
from anon;

-- service_role es exclusivo del servidor y conserva privilegios base mínimos.
grant select, insert, update, delete
on table
  public.productos,
  public.variantes_producto,
  public.ventas,
  public.detalle_ventas,
  public.pagos_venta
to service_role;

grant select, insert
on table public.movimientos_inventario, public.auditoria
to service_role;

grant select, insert, update
on table public.stock_producto
to service_role;

grant usage, select on all sequences in schema public to service_role;
