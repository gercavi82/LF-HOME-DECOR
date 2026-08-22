-- Fase 40: rate limiting persistente y endurecimiento de privilegios.

create table if not exists public.auth_rate_limits (
  clave_hash text primary key,
  intentos integer not null default 0 check (intentos >= 0),
  ventana_inicio timestamptz not null default clock_timestamp(),
  bloqueado_hasta timestamptz,
  actualizado_en timestamptz not null default clock_timestamp()
);

alter table public.auth_rate_limits enable row level security;
revoke all on table public.auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_rate_limits to service_role;

create or replace function public.sp_controlar_limite_login(p_clave_hash text, p_operacion text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_fila public.auth_rate_limits%rowtype; v_ahora timestamptz := clock_timestamp();
begin
  if length(p_clave_hash) <> 64 or p_clave_hash !~ '^[a-f0-9]{64}$' then raise exception 'Clave de control inválida.' using errcode = '22023'; end if;
  if p_operacion not in ('CHECK', 'FAILURE', 'SUCCESS') then raise exception 'Operación inválida.' using errcode = '22023'; end if;
  insert into public.auth_rate_limits (clave_hash) values (p_clave_hash) on conflict do nothing;
  select * into v_fila from public.auth_rate_limits where clave_hash = p_clave_hash for update;
  if p_operacion = 'SUCCESS' then delete from public.auth_rate_limits where clave_hash = p_clave_hash; return jsonb_build_object('permitido', true, 'reintentar_en', 0); end if;
  if v_fila.bloqueado_hasta is not null and v_fila.bloqueado_hasta > v_ahora then return jsonb_build_object('permitido', false, 'reintentar_en', ceil(extract(epoch from (v_fila.bloqueado_hasta - v_ahora)))); end if;
  if v_fila.ventana_inicio < v_ahora - interval '15 minutes' then update public.auth_rate_limits set intentos = 0, ventana_inicio = v_ahora, bloqueado_hasta = null, actualizado_en = v_ahora where clave_hash = p_clave_hash; v_fila.intentos := 0; end if;
  if p_operacion = 'FAILURE' then
    update public.auth_rate_limits set intentos = intentos + 1, bloqueado_hasta = case when intentos + 1 >= 10 then v_ahora + interval '15 minutes' end, actualizado_en = v_ahora where clave_hash = p_clave_hash returning * into v_fila;
  end if;
  return jsonb_build_object('permitido', coalesce(v_fila.bloqueado_hasta <= v_ahora, true), 'reintentar_en', case when v_fila.bloqueado_hasta > v_ahora then ceil(extract(epoch from (v_fila.bloqueado_hasta - v_ahora))) else 0 end);
end; $$;

revoke all on function public.sp_controlar_limite_login(text,text) from public, anon, authenticated;
grant execute on function public.sp_controlar_limite_login(text,text) to service_role;

comment on table public.auth_rate_limits is 'Contadores de acceso por huella SHA-256; no almacena cédulas ni direcciones IP en claro.';
