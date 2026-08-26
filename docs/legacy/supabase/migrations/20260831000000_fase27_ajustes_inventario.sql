-- Fase 27: autorizacion y motivo obligatorio para ajustes manuales.

insert into public.perfil_permisos (id_perfil, id_permiso)
select pf.id_perfil, pm.id_permiso
from public.perfiles pf
cross join public.permisos pm
where pf.nombre = 'Administrador'
  and pm.codigo = 'INVENTARIO_AJUSTAR'
on conflict do nothing;

alter table public.movimientos_inventario
drop constraint if exists movimientos_ajuste_motivo_obligatorio;

alter table public.movimientos_inventario
add constraint movimientos_ajuste_motivo_obligatorio check (
  tipo not in ('ENTRADA_INICIAL','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA')
  or length(trim(coalesce(motivo, ''))) >= 5
) not valid;

grant select on table public.bodegas, public.stock_producto, public.variantes_producto, public.productos to service_role;

comment on constraint movimientos_ajuste_motivo_obligatorio on public.movimientos_inventario is
  'Los ajustes manuales requieren una justificacion de al menos cinco caracteres.';
