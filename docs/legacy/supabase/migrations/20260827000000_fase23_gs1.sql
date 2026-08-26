-- Fase 23: validacion y unicidad GS1. No genera codigos comerciales.

create schema if not exists private;

create or replace function private.gs1_valido(p_codigo text)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  v_codigo text := regexp_replace(p_codigo, '[\s-]', '', 'g');
  v_sum integer := 0;
  v_position integer;
  v_digit integer;
begin
  if v_codigo !~ '^\d+$' or length(v_codigo) not in (8, 12, 13, 14) then return false; end if;
  for v_position in 1..(length(v_codigo) - 1) loop
    v_digit := substring(v_codigo from length(v_codigo) - v_position for 1)::integer;
    v_sum := v_sum + v_digit * case when v_position % 2 = 1 then 3 else 1 end;
  end loop;
  return right(v_codigo, 1)::integer = (10 - (v_sum % 10)) % 10;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.variantes_producto
    group by regexp_replace(codigo_gs1, '[\s-]', '', 'g')
    having count(*) > 1
  ) then
    raise exception 'Existen codigos GS1 duplicados. Corrijalos antes de aplicar Fase 23.';
  end if;
end;
$$;

create unique index if not exists variantes_producto_codigo_gs1_normalizado_uq
on public.variantes_producto ((regexp_replace(codigo_gs1, '[\s-]', '', 'g')));

alter table public.variantes_producto
drop constraint if exists variantes_producto_codigo_gs1_valido;

alter table public.variantes_producto
add constraint variantes_producto_codigo_gs1_valido
check (private.gs1_valido(codigo_gs1)) not valid;

comment on constraint variantes_producto_codigo_gs1_valido on public.variantes_producto is
  'Acepta GTIN-8, UPC-A/GTIN-12, EAN-13 y GTIN-14 con digito verificador valido.';
