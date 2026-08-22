-- Fase 24: porcentaje configurable y desglose de total incluido IVA.

grant select on table public.parametros_sistema to service_role;

insert into public.parametros_sistema (codigo, valor, descripcion, tipo_dato, editable)
values ('IVA_PORCENTAJE', '15', 'Porcentaje de IVA aplicado a nuevos productos', 'NUMERIC', true)
on conflict (codigo) do nothing;

create or replace function public.calcular_iva_incluido(p_total numeric, p_porcentaje numeric)
returns table (subtotal numeric, iva numeric, total numeric)
language sql
immutable
strict
set search_path = pg_catalog
as $$
  with calculo as (
    select
      round(p_total, 2) as total_redondeado,
      round(round(p_total, 2) / (1 + p_porcentaje / 100), 2) as subtotal_redondeado
    where p_total >= 0 and p_porcentaje between 0 and 100
  )
  select subtotal_redondeado, total_redondeado - subtotal_redondeado, total_redondeado
  from calculo;
$$;

revoke all on function public.calcular_iva_incluido(numeric, numeric) from public, anon;
grant execute on function public.calcular_iva_incluido(numeric, numeric) to authenticated, service_role;

alter table public.variantes_producto
drop constraint if exists variantes_producto_valores_iva_validos;

alter table public.variantes_producto
add constraint variantes_producto_valores_iva_validos check (
  precio_venta > 0
  and precio_venta = round(precio_venta, 2)
  and porcentaje_iva between 0 and 100
) not valid;

comment on function public.calcular_iva_incluido(numeric, numeric) is
  'Desglosa un total incluido IVA garantizando subtotal + IVA = total.';
