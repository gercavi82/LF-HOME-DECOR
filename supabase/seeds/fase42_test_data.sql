-- Fase 42: DATOS FICTICIOS. NO EJECUTAR EN PRODUCCIÓN.
-- Requiere un parámetro ENTORNO con valor TEST, DEVELOPMENT, DESARROLLO o LOCAL.

begin;

do $$
begin
  if not exists (
    select 1 from public.parametros_sistema
    where codigo = 'ENTORNO' and upper(trim(valor)) in ('TEST', 'DEVELOPMENT', 'DESARROLLO', 'LOCAL')
  ) then
    raise exception 'SEGURIDAD FASE 42: datos de prueba bloqueados. Configure ENTORNO=TEST únicamente en una base no productiva.';
  end if;
  if not exists (
    select 1 from public.usuarios u join public.perfiles p using (id_perfil)
    where p.codigo = 'ADMINISTRADOR' and u.activo
  ) then
    raise exception 'FASE 42: se requiere un usuario Administrador activo como creador de los productos.';
  end if;
end;
$$;

insert into public.tipos_producto (nombre, descripcion, activo)
select 'Textil de dormitorio', 'Tipo auxiliar para datos de prueba Fase 42', true
where not exists (select 1 from public.tipos_producto where lower(trim(nombre)) = 'textil de dormitorio');

insert into public.colores (nombre, codigo_hex, activo)
select 'Neutro prueba', '#D9D1C6', true
where not exists (select 1 from public.colores where lower(trim(nombre)) = 'neutro prueba');

insert into public.disenos (nombre, descripcion, activo)
select 'Clásico prueba', 'Diseño auxiliar para datos de prueba Fase 42', true
where not exists (select 1 from public.disenos where lower(trim(nombre)) = 'clásico prueba');

insert into public.unidades_medida (codigo, nombre, activo)
select 'UND', 'Unidad', true
where not exists (select 1 from public.unidades_medida where upper(trim(codigo)) = 'UND');

do $$
declare
  v_admin bigint;
  v_tipo bigint;
  v_marca bigint;
  v_color bigint;
  v_diseno bigint;
  v_unidad bigint;
  v_product_id bigint;
  v_row record;
begin
  select u.id_usuario into v_admin from public.usuarios u join public.perfiles p using (id_perfil) where p.codigo = 'ADMINISTRADOR' and u.activo order by u.id_usuario limit 1;
  select id_tipo into v_tipo from public.tipos_producto where lower(trim(nombre)) = 'textil de dormitorio' limit 1;
  select id_marca into v_marca from public.marcas where lower(trim(nombre)) = lower('L&F Home Decor') limit 1;
  select id_color into v_color from public.colores where lower(trim(nombre)) = 'neutro prueba' limit 1;
  select id_diseno into v_diseno from public.disenos where lower(trim(nombre)) = 'clásico prueba' limit 1;
  select id_unidad into v_unidad from public.unidades_medida where upper(trim(codigo)) = 'UND' limit 1;

  if v_marca is null then raise exception 'FASE 42: ejecute primero supabase/seed.sql para crear la marca inicial.'; end if;

  for v_row in select * from (values
    ('Sábana Algodón 2 Plazas', 'Sábanas', 'Algodón', '2 Plazas', '2000000000015', 39.90::numeric, 5::numeric),
    ('Edredón Microfibra Queen', 'Edredones', 'Microfibra', 'Queen', '2000000000022', 74.90::numeric, 4::numeric),
    ('Cobertor Sherpa', 'Cobertores', 'Sherpa', 'Estándar', '2000000000039', 54.90::numeric, 4::numeric),
    ('Almohada Visco', 'Almohadas', 'Viscoelástica', 'Estándar', '2000000000046', 29.90::numeric, 6::numeric),
    ('Protector Colchón', 'Protectores', 'Impermeable', 'Queen', '2000000000053', 34.90::numeric, 5::numeric)
  ) as seed(descripcion, categoria, material, tamano, gs1, precio, minimo)
  loop
    select p.id_producto into v_product_id from public.productos p where p.descripcion = v_row.descripcion and p.detalle = '[FASE42_TEST]' limit 1;
    if v_product_id is null then
      insert into public.productos (id_categoria, id_tipo, id_marca, descripcion, detalle, activo, creado_por)
      select c.id_categoria, v_tipo, v_marca, v_row.descripcion, '[FASE42_TEST]', true, v_admin
      from public.categorias c where c.nombre = v_row.categoria limit 1
      returning id_producto into v_product_id;
    end if;
    if v_product_id is null then raise exception 'FASE 42: catálogo incompleto para %.', v_row.descripcion; end if;
    if not exists (select 1 from public.variantes_producto where codigo_gs1 = v_row.gs1) then
      insert into public.variantes_producto (id_producto, codigo_gs1, id_material, id_tamano, id_color, id_diseno, id_unidad, precio_venta, porcentaje_iva, stock_minimo, activo)
      select v_product_id, v_row.gs1, m.id_material, t.id_tamano, v_color, v_diseno, v_unidad, v_row.precio, 15, v_row.minimo, true
      from public.materiales m cross join public.tamanos t
      where m.nombre = v_row.material and t.nombre = v_row.tamano limit 1;
    end if;
    v_product_id := null;
  end loop;
end;
$$;

commit;

select descripcion, detalle from public.productos where detalle = '[FASE42_TEST]' order by descripcion;
