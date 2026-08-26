-- Fase 25: lectura segura del inventario consolidado.

alter view public.vw_inventario_actual set (security_invoker = true);

revoke all on table public.vw_inventario_actual from anon;
grant select on table public.vw_inventario_actual to authenticated, service_role;

grant select on table
  public.stock_producto,
  public.variantes_producto,
  public.productos,
  public.bodegas,
  public.categorias,
  public.marcas,
  public.materiales,
  public.tamanos,
  public.colores,
  public.disenos
to authenticated, service_role;

comment on view public.vw_inventario_actual is
  'Existencias consolidadas por variante y bodega; respeta RLS de las tablas base.';
