-- Fase 20: indicadores del dashboard en zona horaria de Ecuador.

create or replace view public.vw_dashboard_ventas
with (security_invoker = true)
as
select
  coalesce(sum(v.total) filter (
    where (v.fecha at time zone 'America/Guayaquil')::date =
      (now() at time zone 'America/Guayaquil')::date
      and upper(coalesce(v.estado, '')) not in ('ANULADA', 'ANULADO')
  ), 0)::numeric as ventas_hoy,
  coalesce(sum(v.total) filter (
    where date_trunc('month', v.fecha at time zone 'America/Guayaquil') =
      date_trunc('month', now() at time zone 'America/Guayaquil')
      and upper(coalesce(v.estado, '')) not in ('ANULADA', 'ANULADO')
  ), 0)::numeric as ventas_mes,
  count(*) filter (
    where (v.fecha at time zone 'America/Guayaquil')::date =
      (now() at time zone 'America/Guayaquil')::date
      and upper(coalesce(v.estado, '')) not in ('ANULADA', 'ANULADO')
  )::bigint as cantidad_ventas_hoy,
  count(*) filter (
    where date_trunc('month', v.fecha at time zone 'America/Guayaquil') =
      date_trunc('month', now() at time zone 'America/Guayaquil')
      and upper(coalesce(v.estado, '')) not in ('ANULADA', 'ANULADO')
  )::bigint as cantidad_ventas_mes
from public.ventas v;

revoke all on table
  public.vw_dashboard_ventas,
  public.vw_productos_bajo_stock,
  public.vw_productos_agotados
from anon;

grant select on table
  public.vw_dashboard_ventas,
  public.vw_productos_bajo_stock,
  public.vw_productos_agotados
to authenticated, service_role;

comment on view public.vw_dashboard_ventas is
  'Indicadores diarios y mensuales, excluyendo anulaciones y usando America/Guayaquil.';
