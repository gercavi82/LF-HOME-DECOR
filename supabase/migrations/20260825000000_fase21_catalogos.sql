-- Fase 21: CRUD administrativo de catalogos desde acciones server-side.

grant select, insert, update, delete on table
  public.categorias,
  public.marcas,
  public.tipos_producto,
  public.materiales,
  public.tamanos,
  public.colores,
  public.disenos,
  public.unidades_medida
to service_role;

grant usage, select on all sequences in schema public to service_role;

revoke insert, update, delete on table
  public.categorias,
  public.marcas,
  public.tipos_producto,
  public.materiales,
  public.tamanos,
  public.colores,
  public.disenos,
  public.unidades_medida
from anon, authenticated;
