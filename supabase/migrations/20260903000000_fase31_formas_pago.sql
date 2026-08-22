-- Fase 31: formas de pago iniciales.

do $$
begin
  if exists (select 1 from public.formas_pago group by upper(trim(codigo)) having count(*) > 1) then
    raise exception 'Existen codigos de forma de pago duplicados. Corrijalos antes de aplicar Fase 31.';
  end if;
end;
$$;

create unique index if not exists formas_pago_codigo_uq on public.formas_pago (codigo);

insert into public.formas_pago (codigo, nombre, requiere_referencia, activo)
values
  ('EFECTIVO', 'Efectivo', false, true),
  ('TRANSFERENCIA', 'Transferencia', true, true),
  ('TARJETA', 'Tarjeta', true, true),
  ('DEUNA', 'DeUna', true, true),
  ('MIXTO', 'Mixto', false, true),
  ('CREDITO_INTERNO', 'Crédito interno', false, true)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  requiere_referencia = excluded.requiere_referencia,
  activo = true;

grant select on table public.formas_pago to authenticated, service_role;
revoke insert, update, delete on table public.formas_pago from anon, authenticated;

comment on table public.formas_pago is
  'Catalogo de medios de cobro; requiere_referencia controla la validacion del comprobante.';
