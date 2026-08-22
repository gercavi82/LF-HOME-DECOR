-- Fase 28: permisos base del modulo de ventas.

grant select on table
  public.ventas,
  public.detalle_ventas,
  public.pagos_venta,
  public.clientes,
  public.canales_venta,
  public.formas_pago,
  public.locales,
  public.usuarios
to service_role;

grant select, insert, update on table public.ventas to service_role;
grant select, insert on table public.detalle_ventas, public.pagos_venta to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into public.perfil_permisos (id_perfil, id_permiso)
select pf.id_perfil, pm.id_permiso
from public.perfiles pf cross join public.permisos pm
where pf.nombre = 'Administrador' and pm.codigo in ('VENTA_VER', 'VENTA_CREAR')
on conflict do nothing;
