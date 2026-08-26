-- Ejecutar despues de 20260823000000_fase19_auditoria.sql.
-- La transaccion se revierte: no conserva datos de prueba.

begin;

do $$
declare
  v_tables integer;
  v_triggers integer;
begin
  select count(*) into v_tables
  from pg_tables
  where schemaname = 'public' and tablename <> 'auditoria';

  select count(*) into v_triggers
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and n.nspname = 'public'
    and t.tgname = 'trg_fase19_auditoria';

  if v_triggers <> v_tables then
    raise exception 'Cobertura incompleta: % triggers para % tablas', v_triggers, v_tables;
  end if;
end;
$$;

insert into public.auditoria (
  usuario, tabla_afectada, accion, registro_id, valor_nuevo
) values (
  null, 'auth', 'LOGIN', null, '{"resultado":"PRUEBA"}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.auditoria
    where tabla_afectada = 'auth'
      and accion = 'LOGIN'
      and valor_nuevo ->> 'resultado' = 'PRUEBA'
  ) then
    raise exception 'No fue posible registrar eventos semanticos';
  end if;
end;
$$;

rollback;
