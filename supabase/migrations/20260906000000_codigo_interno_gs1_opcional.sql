-- Código interno obligatorio/autogenerado y GS1 oficial opcional.
create sequence if not exists public.codigo_interno_producto_seq;
revoke all on sequence public.codigo_interno_producto_seq from public, anon, authenticated;
grant usage, select on sequence public.codigo_interno_producto_seq to service_role;
alter table public.variantes_producto add column if not exists codigo_interno varchar(40);
alter table public.variantes_producto alter column codigo_gs1 drop not null;
update public.variantes_producto set codigo_gs1 = null where btrim(coalesce(codigo_gs1, '')) = '';
create or replace function public.fn_codigo_interno_producto() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_categoria text; v_tipo bigint;
begin
  if tg_op = 'UPDATE' and old.codigo_interno is not null then
    new.codigo_interno := old.codigo_interno;
  elsif nullif(btrim(new.codigo_interno), '') is null then
    select upper(regexp_replace(coalesce(c.codigo, 'CAT'), '[^A-Za-z0-9]', '', 'g')), p.id_tipo into v_categoria, v_tipo
    from public.productos p join public.categorias c on c.id_categoria = p.id_categoria where p.id_producto = new.id_producto;
    if not found then raise exception 'No fue posible generar el código interno: producto sin categoría.' using errcode = '23503'; end if;
    new.codigo_interno := left(v_categoria, 8) || '-T' || v_tipo || '-' || lpad(nextval('public.codigo_interno_producto_seq')::text, 6, '0');
  end if;
  new.codigo_gs1 := nullif(regexp_replace(coalesce(new.codigo_gs1, ''), '[[:space:]-]', '', 'g'), '');
  return new;
end; $$;
drop trigger if exists trg_codigo_interno_producto on public.variantes_producto;
create trigger trg_codigo_interno_producto before insert or update on public.variantes_producto for each row execute function public.fn_codigo_interno_producto();
update public.variantes_producto set codigo_interno = null where codigo_interno is null;
alter table public.variantes_producto alter column codigo_interno set not null;
create unique index if not exists variantes_codigo_interno_uq on public.variantes_producto (codigo_interno);
create unique index if not exists variantes_codigo_gs1_presente_uq on public.variantes_producto (codigo_gs1) where codigo_gs1 is not null;
revoke all on function public.fn_codigo_interno_producto() from public, anon, authenticated;
comment on column public.variantes_producto.codigo_interno is 'Identificador interno obligatorio, automático e inmutable; no representa un GTIN oficial.';
comment on column public.variantes_producto.codigo_gs1 is 'GTIN/UPC/EAN oficial opcional del fabricante o asignado por GS1.';
