-- Fase 26: toda variacion de existencias pasa por este unico procedimiento.

do $$
declare v_signature regprocedure;
begin
  for v_signature in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sp_registrar_movimiento_inventario'
  loop
    execute format('drop function %s', v_signature);
  end loop;
end;
$$;

create function public.sp_registrar_movimiento_inventario(
  p_variante bigint,
  p_bodega bigint,
  p_tipo varchar,
  p_cantidad numeric,
  p_usuario bigint,
  p_motivo text default null,
  p_referencia_tipo varchar default null,
  p_referencia_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tipo varchar := upper(trim(p_tipo));
  v_stock_id bigint;
  v_stock_anterior numeric := 0;
  v_stock_nuevo numeric;
  v_factor integer;
  v_movimiento_id bigint;
begin
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023'; end if;
  if v_tipo not in ('ENTRADA_INICIAL','COMPRA','VENTA','DEVOLUCION_COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') then
    raise exception 'Tipo de movimiento no permitido: %', v_tipo using errcode = '22023';
  end if;
  if v_tipo in ('ENTRADA_INICIAL','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA') and coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo es obligatorio para ajustes manuales.' using errcode = '22023';
  end if;
  if not exists (select 1 from variantes_producto where id_variante = p_variante and activo) then raise exception 'La variante no existe o está inactiva.' using errcode = '23503'; end if;
  if not exists (select 1 from bodegas where id_bodega = p_bodega and activo) then raise exception 'La bodega no existe o está inactiva.' using errcode = '23503'; end if;
  if not exists (select 1 from usuarios where id_usuario = p_usuario and activo and not bloqueado) then raise exception 'El usuario no está autorizado.' using errcode = '42501'; end if;

  v_factor := case when v_tipo in ('ENTRADA_INICIAL','COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','CORRECCION_ENTRADA') then 1 else -1 end;

  select id_stock, cantidad into v_stock_id, v_stock_anterior
  from stock_producto where id_variante = p_variante and id_bodega = p_bodega
  for update;

  if v_stock_id is null then
    if v_factor < 0 then raise exception 'No existe stock disponible para realizar la salida.' using errcode = '23514'; end if;
    insert into stock_producto (id_variante, id_bodega, cantidad, fecha_actualizacion)
    values (p_variante, p_bodega, 0, clock_timestamp())
    returning id_stock into v_stock_id;
    v_stock_anterior := 0;
  end if;

  v_stock_nuevo := v_stock_anterior + (p_cantidad * v_factor);
  if v_stock_nuevo < 0 then raise exception 'Stock insuficiente. Disponible: %, solicitado: %', v_stock_anterior, p_cantidad using errcode = '23514'; end if;

  update stock_producto set cantidad = v_stock_nuevo, fecha_actualizacion = clock_timestamp() where id_stock = v_stock_id;

  insert into movimientos_inventario (id_variante, id_bodega, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario, fecha)
  values (p_variante, p_bodega, v_tipo, p_cantidad, v_stock_anterior, v_stock_nuevo, nullif(trim(p_motivo), ''), nullif(trim(p_referencia_tipo), ''), p_referencia_id, p_usuario, clock_timestamp())
  returning id_movimiento into v_movimiento_id;

  return v_movimiento_id;
end;
$$;

revoke all on function public.sp_registrar_movimiento_inventario(bigint,bigint,varchar,numeric,bigint,text,varchar,bigint) from public, anon, authenticated;
grant execute on function public.sp_registrar_movimiento_inventario(bigint,bigint,varchar,numeric,bigint,text,varchar,bigint) to service_role;

alter table public.stock_producto drop constraint if exists stock_producto_cantidad_no_negativa;
alter table public.stock_producto add constraint stock_producto_cantidad_no_negativa check (cantidad >= 0) not valid;

alter table public.movimientos_inventario drop constraint if exists movimientos_inventario_tipo_valido;
alter table public.movimientos_inventario add constraint movimientos_inventario_tipo_valido check (tipo in ('ENTRADA_INICIAL','COMPRA','VENTA','DEVOLUCION_COMPRA','DEVOLUCION_VENTA','AJUSTE_SOBRANTE','AJUSTE_FALTANTE','PERDIDA','DANO','CORRECCION_ENTRADA','CORRECCION_SALIDA')) not valid;

comment on function public.sp_registrar_movimiento_inventario(bigint,bigint,varchar,numeric,bigint,text,varchar,bigint) is
  'Unico punto autorizado para modificar existencias; bloquea la fila y registra antes/despues atomicamente.';
