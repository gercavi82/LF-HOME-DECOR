-- Fase 19: auditoria transversal con valores anteriores y nuevos.
-- Es idempotente: reemplaza los triggers que ya usaban fn_auditoria.

create or replace function public.fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_anterior jsonb;
  v_nuevo jsonb;
  v_fila jsonb;
  v_usuario bigint;
  v_registro_id bigint;
  v_accion text := tg_op;
  v_pk text;
  v_pk_value text;
begin
  if tg_table_name = 'auditoria' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_anterior := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_nuevo := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;

  if tg_op = 'UPDATE' and v_anterior = v_nuevo then
    return new;
  end if;

  v_fila := coalesce(v_nuevo, v_anterior);

  select a.attname
    into v_pk
  from pg_index i
  join pg_attribute a
    on a.attrelid = i.indrelid
   and a.attnum = any(i.indkey)
  where i.indrelid = tg_relid
    and i.indisprimary
  order by a.attnum
  limit 1;

  if v_pk is not null then
    v_pk_value := v_fila ->> v_pk;
    if v_pk_value ~ '^\d+$' then
      v_registro_id := v_pk_value::bigint;
    end if;
  end if;

  begin
    select u.id_usuario
      into v_usuario
    from public.usuarios u
    where u.auth_user_id = auth.uid()
    limit 1;
  exception when others then
    v_usuario := null;
  end;

  -- Las operaciones server-side no tienen auth.uid(); usa el responsable de la fila.
  if v_usuario is null and coalesce(v_fila ->> 'id_usuario', '') ~ '^\d+$' then
    v_usuario := (v_fila ->> 'id_usuario')::bigint;
  elsif v_usuario is null and coalesce(v_fila ->> 'usuario', '') ~ '^\d+$' then
    v_usuario := (v_fila ->> 'usuario')::bigint;
  end if;

  if tg_table_name = 'ventas' and tg_op = 'INSERT' then
    v_accion := 'VENTA';
  elsif tg_table_name = 'ventas'
    and tg_op = 'UPDATE'
    and upper(coalesce(v_nuevo ->> 'estado', '')) in ('ANULADA', 'ANULADO')
    and upper(coalesce(v_anterior ->> 'estado', '')) not in ('ANULADA', 'ANULADO') then
    v_accion := 'ANULACION';
  elsif tg_table_name = 'movimientos_inventario'
    and tg_op = 'INSERT'
    and upper(coalesce(v_nuevo ->> 'tipo', '')) like 'AJUSTE%' then
    v_accion := 'AJUSTE_INVENTARIO';
  end if;

  insert into public.auditoria (
    usuario,
    tabla_afectada,
    accion,
    registro_id,
    valor_anterior,
    valor_nuevo,
    fecha
  ) values (
    v_usuario,
    tg_table_name,
    v_accion,
    v_registro_id,
    v_anterior,
    v_nuevo,
    clock_timestamp()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.fn_auditoria() from public, anon, authenticated;

do $$
declare
  v_trigger record;
  v_table record;
begin
  -- Elimina triggers anteriores que invocaban la misma funcion para evitar duplicados.
  for v_trigger in
    select n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and n.nspname = 'public'
      and p.proname = 'fn_auditoria'
  loop
    execute format(
      'drop trigger if exists %I on %I.%I',
      v_trigger.trigger_name,
      v_trigger.schema_name,
      v_trigger.table_name
    );
  end loop;

  -- Audita todas las tablas operativas presentes y futuras de esta migracion.
  for v_table in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'auditoria'
  loop
    execute format(
      'create trigger trg_fase19_auditoria after insert or update or delete on %I.%I for each row execute function public.fn_auditoria()',
      v_table.schemaname,
      v_table.tablename
    );
  end loop;
end;
$$;

grant select, insert on table public.auditoria to service_role;
grant usage, select on sequence public.auditoria_id_auditoria_seq to service_role;

comment on function public.fn_auditoria() is
  'Registra INSERT, UPDATE y DELETE con usuario, registro y estados anterior/nuevo.';
