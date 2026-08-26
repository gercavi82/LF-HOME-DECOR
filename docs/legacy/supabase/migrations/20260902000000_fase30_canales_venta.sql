-- Fase 30: canales iniciales de venta.

do $$
begin
  if exists (select 1 from public.canales_venta group by upper(trim(codigo)) having count(*) > 1) then
    raise exception 'Existen codigos de canal duplicados. Corrijalos antes de aplicar Fase 30.';
  end if;
end;
$$;

create unique index if not exists canales_venta_codigo_uq
on public.canales_venta (codigo);

insert into public.canales_venta (codigo, nombre, activo)
values
  ('LOCAL', 'Local', true),
  ('ASESOR', 'Asesor', true),
  ('WHATSAPP', 'WhatsApp', true),
  ('FACEBOOK', 'Facebook', true),
  ('INSTAGRAM', 'Instagram', true),
  ('TIKTOK', 'TikTok', true),
  ('OTROS', 'Otros', true)
on conflict (codigo) do update set nombre = excluded.nombre, activo = true;

grant select on table public.canales_venta to authenticated, service_role;
revoke insert, update, delete on table public.canales_venta from anon, authenticated;

comment on table public.canales_venta is
  'Catalogo configurable de origen comercial utilizado en cada venta.';
