-- Fase 32: venta, detalle, pagos e inventario en una sola transaccion.

grant select on table public.clientes to service_role;

create or replace function public.sp_registrar_venta(
  p_local bigint,
  p_cliente bigint,
  p_canal bigint,
  p_usuario bigint,
  p_descuento numeric,
  p_items jsonb,
  p_pagos jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_pago jsonb;
  v_variante record;
  v_metodo record;
  v_stock record;
  v_sale_id bigint;
  v_numero varchar;
  v_cantidad numeric;
  v_linea_bruta numeric;
  v_linea_descuento numeric;
  v_linea_total numeric;
  v_linea_subtotal numeric;
  v_linea_iva numeric;
  v_bruto numeric := 0;
  v_descuento numeric := round(coalesce(p_descuento, 0), 2);
  v_descuento_asignado numeric := 0;
  v_subtotal numeric := 0;
  v_iva numeric := 0;
  v_total numeric := 0;
  v_pago_total numeric := 0;
  v_restante numeric;
  v_tomar numeric;
  v_indice integer := 0;
  v_total_items integer;
  v_es_admin boolean;
  v_local_usuario bigint;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La venta debe tener productos.' using errcode = '22023'; end if;
  if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then raise exception 'La venta debe tener pagos.' using errcode = '22023'; end if;
  if v_descuento < 0 then raise exception 'El descuento no puede ser negativo.' using errcode = '22023'; end if;

  select pf.nombre = 'Administrador', u.id_local into v_es_admin, v_local_usuario
  from usuarios u join perfiles pf on pf.id_perfil = u.id_perfil
  where u.id_usuario = p_usuario and u.activo and not u.bloqueado;
  if not found then raise exception 'Usuario no autorizado.' using errcode = '42501'; end if;
  if not v_es_admin and v_local_usuario is distinct from p_local then raise exception 'El usuario no pertenece al local seleccionado.' using errcode = '42501'; end if;
  if not exists (select 1 from perfil_permisos pp join permisos pm on pm.id_permiso = pp.id_permiso join usuarios u on u.id_perfil = pp.id_perfil where u.id_usuario = p_usuario and pm.codigo = 'VENTA_CREAR') and not v_es_admin then raise exception 'El usuario no tiene permiso para vender.' using errcode = '42501'; end if;
  if not exists (select 1 from locales where id_local = p_local and activo) then raise exception 'Local inválido.' using errcode = '23503'; end if;
  if not exists (select 1 from canales_venta where id_canal = p_canal and activo) then raise exception 'Canal inválido.' using errcode = '23503'; end if;
  if p_cliente is not null and not exists (select 1 from clientes where id_cliente = p_cliente and activo) then raise exception 'Cliente inválido.' using errcode = '23503'; end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct (value->>'id_variante')::bigint) from jsonb_array_elements(p_items)) then raise exception 'No se permiten variantes duplicadas.' using errcode = '22023'; end if;

  v_total_items := jsonb_array_length(p_items);
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero.' using errcode = '22023'; end if;
    select vp.id_variante, vp.precio_venta, vp.porcentaje_iva into v_variante
    from variantes_producto vp join productos p on p.id_producto = vp.id_producto
    where vp.id_variante = (v_item->>'id_variante')::bigint and vp.activo and p.activo for share;
    if not found or v_variante.precio_venta <= 0 then raise exception 'Producto inactivo o con precio inválido.' using errcode = '23514'; end if;
    v_bruto := v_bruto + round(v_variante.precio_venta * v_cantidad, 2);
  end loop;
  v_bruto := round(v_bruto, 2);
  if v_descuento > v_bruto then raise exception 'El descuento supera el valor de la venta.' using errcode = '23514'; end if;
  v_total := v_bruto - v_descuento;

  v_indice := 0; v_descuento_asignado := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_indice := v_indice + 1; v_cantidad := (v_item->>'cantidad')::numeric;
    select precio_venta, porcentaje_iva into v_variante from variantes_producto where id_variante = (v_item->>'id_variante')::bigint;
    v_linea_bruta := round(v_variante.precio_venta * v_cantidad, 2);
    v_linea_descuento := case when v_indice = v_total_items then v_descuento - v_descuento_asignado else round(v_descuento * v_linea_bruta / nullif(v_bruto, 0), 2) end;
    v_descuento_asignado := v_descuento_asignado + v_linea_descuento;
    v_linea_total := v_linea_bruta - v_linea_descuento;
    v_linea_subtotal := round(v_linea_total / (1 + v_variante.porcentaje_iva / 100), 2);
    v_linea_iva := v_linea_total - v_linea_subtotal;
    v_subtotal := v_subtotal + v_linea_subtotal; v_iva := v_iva + v_linea_iva;
  end loop;
  v_subtotal := round(v_subtotal, 2); v_iva := round(v_iva, 2);
  if v_subtotal + v_iva <> v_total then v_iva := v_total - v_subtotal; end if;

  for v_pago in select value from jsonb_array_elements(p_pagos) loop
    select id_forma_pago, codigo, requiere_referencia into v_metodo from formas_pago where id_forma_pago = (v_pago->>'id_forma_pago')::bigint and activo;
    if not found or coalesce((v_pago->>'valor')::numeric, 0) <= 0 then raise exception 'Forma o valor de pago inválido.' using errcode = '22023'; end if;
    if v_metodo.codigo = 'MIXTO' then raise exception 'Mixto debe desglosarse en formas de pago reales.' using errcode = '22023'; end if;
    if v_metodo.requiere_referencia and length(trim(coalesce(v_pago->>'referencia', ''))) < 3 then raise exception 'La referencia de pago es obligatoria.' using errcode = '22023'; end if;
    if v_metodo.codigo = 'CREDITO_INTERNO' and p_cliente is null then raise exception 'El crédito interno requiere un cliente.' using errcode = '22023'; end if;
    v_pago_total := v_pago_total + round((v_pago->>'valor')::numeric, 2);
  end loop;
  if round(v_pago_total, 2) <> v_total then raise exception 'La suma de pagos (%) no coincide con el total (%).', v_pago_total, v_total using errcode = '23514'; end if;

  v_numero := 'V-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into ventas (numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, subtotal, descuento, iva, total, observaciones, estado)
  values (v_numero, p_local, p_cliente, p_canal, p_usuario, clock_timestamp(), v_subtotal, v_descuento, v_iva, v_total, nullif(trim(p_observaciones), ''), 'REGISTRADA')
  returning id_venta into v_sale_id;

  v_indice := 0; v_descuento_asignado := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_indice := v_indice + 1; v_cantidad := (v_item->>'cantidad')::numeric;
    select id_variante, precio_venta, porcentaje_iva into v_variante from variantes_producto where id_variante = (v_item->>'id_variante')::bigint;
    v_linea_bruta := round(v_variante.precio_venta * v_cantidad, 2);
    v_linea_descuento := case when v_indice = v_total_items then v_descuento - v_descuento_asignado else round(v_descuento * v_linea_bruta / nullif(v_bruto, 0), 2) end;
    v_descuento_asignado := v_descuento_asignado + v_linea_descuento; v_linea_total := v_linea_bruta - v_linea_descuento;
    v_linea_subtotal := round(v_linea_total / (1 + v_variante.porcentaje_iva / 100), 2); v_linea_iva := v_linea_total - v_linea_subtotal;
    insert into detalle_ventas (id_venta, id_variante, cantidad, precio_unitario, descuento, porcentaje_iva, subtotal, iva, total)
    values (v_sale_id, v_variante.id_variante, v_cantidad, v_variante.precio_venta, v_linea_descuento, v_variante.porcentaje_iva, v_linea_subtotal, v_linea_iva, v_linea_total);

    v_restante := v_cantidad;
    for v_stock in select sp.id_bodega, sp.cantidad from stock_producto sp join bodegas b on b.id_bodega = sp.id_bodega where sp.id_variante = v_variante.id_variante and b.id_local = p_local and b.activo and sp.cantidad > 0 order by sp.cantidad desc for update of sp loop
      exit when v_restante <= 0; v_tomar := least(v_restante, v_stock.cantidad);
      perform sp_registrar_movimiento_inventario(v_variante.id_variante, v_stock.id_bodega, 'VENTA', v_tomar, p_usuario, 'Venta ' || v_numero, 'VENTA', v_sale_id);
      v_restante := v_restante - v_tomar;
    end loop;
    if v_restante > 0 then raise exception 'Stock insuficiente para la variante %.', v_variante.id_variante using errcode = '23514'; end if;
  end loop;

  for v_pago in select value from jsonb_array_elements(p_pagos) loop
    insert into pagos_venta (id_venta, id_forma_pago, valor, referencia, fecha)
    values (v_sale_id, (v_pago->>'id_forma_pago')::bigint, round((v_pago->>'valor')::numeric, 2), nullif(trim(v_pago->>'referencia'), ''), clock_timestamp());
  end loop;

  return jsonb_build_object('id_venta', v_sale_id, 'numero_venta', v_numero, 'total', v_total);
end;
$$;

revoke all on function public.sp_registrar_venta(bigint,bigint,bigint,bigint,numeric,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.sp_registrar_venta(bigint,bigint,bigint,bigint,numeric,jsonb,jsonb,text) to service_role;

comment on function public.sp_registrar_venta(bigint,bigint,bigint,bigint,numeric,jsonb,jsonb,text) is
  'Registra venta, detalle, pagos y salidas de inventario atomicamente; cualquier error revierte todo.';
