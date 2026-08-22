import "server-only";

import { createAdminClient } from "@/src/lib/supabase/admin";
import { requirePermission, ROLE_NAMES } from "@/src/services/auth/authorization";

export type SaleListItem = {
  id_venta: number;
  numero_venta: string;
  fecha: string;
  local: string;
  cliente: string;
  canal: string;
  vendedor: string;
  total: number;
  estado: string;
};

export type SaleProduct = {
  id_variante: number;
  id_producto: number;
  producto: string;
  codigo_interno: string;
  codigo_gs1: string | null;
  precio: number;
  porcentaje_iva: number;
  imagen_url: string | null;
  stockPorLocal: Record<number, number>;
};
export type SaleChannel = { id_canal: number; codigo: string; nombre: string };
export type SalePaymentMethod = { id_forma_pago: number; codigo: string; nombre: string; requiere_referencia: boolean };
export type SaleCustomer = { id_cliente: number; nombre: string; identificacion: string | null };

export type SaleReceipt = {
  id_venta: number;
  numero_venta: string;
  fecha: string;
  local: string;
  cliente: string;
  identificacion: string | null;
  vendedor: string;
  canal: string;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  estado: string;
  items: Array<{ id_detalle: number; producto: string; codigo_gs1: string; cantidad: number; precio_unitario: number; subtotal: number; iva: number; total: number }>;
  pagos: Array<{ id_pago: number; forma: string; valor: number; referencia: string | null }>;
};

export type SaleHistoryFilters = { from?: string; to?: string; seller?: number; channel?: number; paymentMethod?: number; number?: string };
export type SaleHistoryItem = SaleListItem & { paymentMethods: string };
export type SaleAuditEntry = { id: number; action: string; table: string; date: string; user: string; previousValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null };

function sanitizeSearch(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}._\-\s]/gu, "").trim().slice(0, 60);
}

export async function listSales(search = "") {
  const context = await requirePermission("VENTA_VER");
  const admin = createAdminClient();
  const normalized = sanitizeSearch(search);
  let query = admin.from("ventas").select("id_venta, numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, total, estado", { count: "exact" }).order("fecha", { ascending: false }).limit(50);
  if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) query = query.eq("id_local", context.id_local);
  if (context.perfil === ROLE_NAMES.ASESOR) query = query.eq("id_usuario", context.id_usuario);
  if (normalized) query = query.ilike("numero_venta", `%${normalized}%`);
  const { data: sales, error, count } = await query;
  if (error) throw new Error("No fue posible cargar las ventas.");
  const rows = sales ?? [];
  const localIds = [...new Set(rows.map((sale) => sale.id_local))];
  const clientIds = [...new Set(rows.map((sale) => sale.id_cliente).filter((id): id is number => id !== null))];
  const channelIds = [...new Set(rows.map((sale) => sale.id_canal))];
  const userIds = [...new Set(rows.map((sale) => sale.id_usuario))];
  const [{ data: locations }, { data: clients }, { data: channels }, { data: users }] = await Promise.all([
    localIds.length ? admin.from("locales").select("id_local, nombre").in("id_local", localIds) : Promise.resolve({ data: [] }),
    clientIds.length ? admin.from("clientes").select("id_cliente, nombres, razon_social, identificacion").in("id_cliente", clientIds) : Promise.resolve({ data: [] }),
    channelIds.length ? admin.from("canales_venta").select("id_canal, nombre").in("id_canal", channelIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from("usuarios").select("id_usuario, nombres, apellidos").in("id_usuario", userIds) : Promise.resolve({ data: [] }),
  ]);
  const locationMap = new Map((locations ?? []).map((item) => [item.id_local, item.nombre]));
  const clientMap = new Map((clients ?? []).map((item) => [item.id_cliente, item.razon_social || item.nombres || item.identificacion || "Cliente"]));
  const channelMap = new Map((channels ?? []).map((item) => [item.id_canal, item.nombre]));
  const userMap = new Map((users ?? []).map((item) => [item.id_usuario, `${item.nombres} ${item.apellidos}`]));
  const mapped: SaleListItem[] = rows.map((sale) => ({ id_venta: sale.id_venta, numero_venta: sale.numero_venta || `#${sale.id_venta}`, fecha: sale.fecha, local: locationMap.get(sale.id_local) ?? "Local", cliente: sale.id_cliente ? clientMap.get(sale.id_cliente) ?? "Cliente" : "Consumidor final", canal: channelMap.get(sale.id_canal) ?? "Canal", vendedor: userMap.get(sale.id_usuario) ?? "Usuario", total: Number(sale.total) || 0, estado: sale.estado }));
  return { sales: mapped, count: count ?? mapped.length, context };
}

export async function getSaleReceipt(id: number): Promise<SaleReceipt | null> {
  const context = await requirePermission("VENTA_VER");
  if (!Number.isInteger(id) || id <= 0) return null;
  const admin = createAdminClient();
  let saleQuery = admin.from("ventas").select("id_venta, numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, subtotal, descuento, iva, total, estado").eq("id_venta", id);
  if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) saleQuery = saleQuery.eq("id_local", context.id_local);
  if (context.perfil === ROLE_NAMES.ASESOR) saleQuery = saleQuery.eq("id_usuario", context.id_usuario);
  const { data: sale, error } = await saleQuery.maybeSingle();
  if (error) throw new Error("No fue posible cargar el comprobante.");
  if (!sale) return null;

  const [{ data: details, error: detailsError }, { data: payments, error: paymentsError }, { data: location }, { data: customer }, { data: channel }, { data: seller }] = await Promise.all([
    admin.from("detalle_ventas").select("id_detalle, id_variante, cantidad, precio_unitario, subtotal, iva, total").eq("id_venta", id).order("id_detalle"),
    admin.from("pagos_venta").select("id_pago, id_forma_pago, valor, referencia").eq("id_venta", id).order("id_pago"),
    admin.from("locales").select("nombre").eq("id_local", sale.id_local).maybeSingle(),
    sale.id_cliente ? admin.from("clientes").select("nombres, razon_social, identificacion").eq("id_cliente", sale.id_cliente).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("canales_venta").select("nombre").eq("id_canal", sale.id_canal).maybeSingle(),
    admin.from("usuarios").select("nombres, apellidos").eq("id_usuario", sale.id_usuario).maybeSingle(),
  ]);
  if (detailsError || paymentsError) throw new Error("No fue posible cargar el detalle del comprobante.");

  const variantIds = [...new Set((details ?? []).map((item) => item.id_variante))];
  const paymentMethodIds = [...new Set((payments ?? []).map((item) => item.id_forma_pago))];
  const [{ data: variants }, { data: methods }] = await Promise.all([
    variantIds.length ? admin.from("variantes_producto").select("id_variante, id_producto, codigo_gs1").in("id_variante", variantIds) : Promise.resolve({ data: [] }),
    paymentMethodIds.length ? admin.from("formas_pago").select("id_forma_pago, nombre").in("id_forma_pago", paymentMethodIds) : Promise.resolve({ data: [] }),
  ]);
  const productIds = [...new Set((variants ?? []).map((item) => item.id_producto))];
  const { data: products } = productIds.length ? await admin.from("productos").select("id_producto, descripcion").in("id_producto", productIds) : { data: [] };
  const variantMap = new Map((variants ?? []).map((item) => [item.id_variante, item]));
  const productMap = new Map((products ?? []).map((item) => [item.id_producto, item.descripcion]));
  const methodMap = new Map((methods ?? []).map((item) => [item.id_forma_pago, item.nombre]));

  return {
    id_venta: sale.id_venta, numero_venta: sale.numero_venta || `#${sale.id_venta}`, fecha: sale.fecha,
    local: location?.nombre ?? "Local", cliente: customer?.razon_social || customer?.nombres || "Consumidor final",
    identificacion: customer?.identificacion ?? null, vendedor: seller ? `${seller.nombres} ${seller.apellidos}`.trim() : "Usuario",
    canal: channel?.nombre ?? "Canal", subtotal: Number(sale.subtotal) || 0, descuento: Number(sale.descuento) || 0,
    iva: Number(sale.iva) || 0, total: Number(sale.total) || 0, estado: sale.estado,
    items: (details ?? []).map((item) => { const variant = variantMap.get(item.id_variante); return { id_detalle: item.id_detalle, producto: variant ? productMap.get(variant.id_producto) ?? "Producto" : "Producto", codigo_gs1: variant?.codigo_gs1 ?? "—", cantidad: Number(item.cantidad) || 0, precio_unitario: Number(item.precio_unitario) || 0, subtotal: Number(item.subtotal) || 0, iva: Number(item.iva) || 0, total: Number(item.total) || 0 }; }),
    pagos: (payments ?? []).map((payment) => ({ id_pago: payment.id_pago, forma: methodMap.get(payment.id_forma_pago) ?? "Forma de pago", valor: Number(payment.valor) || 0, referencia: payment.referencia })),
  };
}

export async function getSaleHistory(filters: SaleHistoryFilters) {
  const context = await requirePermission("VENTA_VER");
  const admin = createAdminClient();
  const number = sanitizeSearch(filters.number ?? "");
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  let query = admin.from("ventas").select("id_venta, numero_venta, id_local, id_cliente, id_canal, id_usuario, fecha, total, estado").order("fecha", { ascending: false }).limit(200);
  if (context.perfil === ROLE_NAMES.VENTA_LOCAL && context.id_local) query = query.eq("id_local", context.id_local);
  if (context.perfil === ROLE_NAMES.ASESOR) query = query.eq("id_usuario", context.id_usuario);
  if (filters.from && validDate.test(filters.from)) query = query.gte("fecha", `${filters.from}T00:00:00-05:00`);
  if (filters.to && validDate.test(filters.to)) query = query.lte("fecha", `${filters.to}T23:59:59.999-05:00`);
  if (filters.seller && Number.isInteger(filters.seller)) query = query.eq("id_usuario", filters.seller);
  if (filters.channel && Number.isInteger(filters.channel)) query = query.eq("id_canal", filters.channel);
  if (number) query = query.ilike("numero_venta", `%${number}%`);
  const { data, error } = await query;
  if (error) throw new Error("No fue posible cargar el historial de ventas.");
  let rows = data ?? [];
  const initialSaleIds = rows.map((sale) => sale.id_venta);
  const { data: allPayments, error: paymentsError } = initialSaleIds.length ? await admin.from("pagos_venta").select("id_venta, id_forma_pago").in("id_venta", initialSaleIds) : { data: [], error: null };
  if (paymentsError) throw new Error("No fue posible cargar las formas de pago del historial.");
  if (filters.paymentMethod && Number.isInteger(filters.paymentMethod)) {
    const matching = new Set((allPayments ?? []).filter((payment) => payment.id_forma_pago === filters.paymentMethod).map((payment) => payment.id_venta));
    rows = rows.filter((sale) => matching.has(sale.id_venta));
  }
  const localIds = [...new Set(rows.map((sale) => sale.id_local))];
  const clientIds = [...new Set(rows.map((sale) => sale.id_cliente).filter((value): value is number => value !== null))];
  const channelIds = [...new Set(rows.map((sale) => sale.id_canal))];
  const userIds = [...new Set(rows.map((sale) => sale.id_usuario))];
  const methodIds = [...new Set((allPayments ?? []).map((payment) => payment.id_forma_pago))];
  const [{ data: locations }, { data: clients }, { data: channels }, { data: users }, { data: methods }, { data: sellerOptions }, { data: channelOptions }, { data: paymentOptions }] = await Promise.all([
    localIds.length ? admin.from("locales").select("id_local, nombre").in("id_local", localIds) : Promise.resolve({ data: [] }),
    clientIds.length ? admin.from("clientes").select("id_cliente, nombres, razon_social, identificacion").in("id_cliente", clientIds) : Promise.resolve({ data: [] }),
    channelIds.length ? admin.from("canales_venta").select("id_canal, nombre").in("id_canal", channelIds) : Promise.resolve({ data: [] }),
    userIds.length ? admin.from("usuarios").select("id_usuario, nombres, apellidos").in("id_usuario", userIds) : Promise.resolve({ data: [] }),
    methodIds.length ? admin.from("formas_pago").select("id_forma_pago, nombre").in("id_forma_pago", methodIds) : Promise.resolve({ data: [] }),
    admin.from("usuarios").select("id_usuario, nombres, apellidos, id_local").eq("activo", true).order("nombres"),
    admin.from("canales_venta").select("id_canal, nombre").eq("activo", true).order("nombre"),
    admin.from("formas_pago").select("id_forma_pago, nombre, codigo").eq("activo", true).neq("codigo", "MIXTO").order("nombre"),
  ]);
  const locationMap = new Map((locations ?? []).map((item) => [item.id_local, item.nombre]));
  const clientMap = new Map((clients ?? []).map((item) => [item.id_cliente, item.razon_social || item.nombres || item.identificacion || "Cliente"]));
  const channelMap = new Map((channels ?? []).map((item) => [item.id_canal, item.nombre]));
  const userMap = new Map((users ?? []).map((item) => [item.id_usuario, `${item.nombres} ${item.apellidos}`.trim()]));
  const methodMap = new Map((methods ?? []).map((item) => [item.id_forma_pago, item.nombre]));
  const paymentMap = new Map<number, string[]>();
  for (const payment of allPayments ?? []) paymentMap.set(payment.id_venta, [...(paymentMap.get(payment.id_venta) ?? []), methodMap.get(payment.id_forma_pago) ?? "Forma de pago"]);
  const sales: SaleHistoryItem[] = rows.map((sale) => ({ id_venta: sale.id_venta, numero_venta: sale.numero_venta || `#${sale.id_venta}`, fecha: sale.fecha, local: locationMap.get(sale.id_local) ?? "Local", cliente: sale.id_cliente ? clientMap.get(sale.id_cliente) ?? "Cliente" : "Consumidor final", canal: channelMap.get(sale.id_canal) ?? "Canal", vendedor: userMap.get(sale.id_usuario) ?? "Usuario", total: Number(sale.total) || 0, estado: sale.estado, paymentMethods: [...new Set(paymentMap.get(sale.id_venta) ?? ["Sin registro"])].join(" + ") }));
  const visibleSellers = (sellerOptions ?? []).filter((seller) => context.perfil === ROLE_NAMES.ADMINISTRADOR || context.perfil === ROLE_NAMES.VENTA_LOCAL && seller.id_local === context.id_local || seller.id_usuario === context.id_usuario);
  return { sales, sellers: visibleSellers.map((seller) => ({ id: seller.id_usuario, name: `${seller.nombres} ${seller.apellidos}`.trim() })), channels: channelOptions ?? [], paymentMethods: paymentOptions ?? [] };
}

export async function getSaleDetail(id: number) {
  const receipt = await getSaleReceipt(id);
  if (!receipt) return null;
  const admin = createAdminClient();
  const detailIds = receipt.items.map((item) => item.id_detalle);
  const paymentIds = receipt.pagos.map((payment) => payment.id_pago);
  const [{ data: saleAudit, error: saleError }, { data: detailAudit, error: detailError }, { data: paymentAudit, error: paymentError }] = await Promise.all([
    admin.from("auditoria").select("id_auditoria, usuario, tabla_afectada, accion, valor_anterior, valor_nuevo, fecha").eq("tabla_afectada", "ventas").eq("registro_id", id),
    detailIds.length ? admin.from("auditoria").select("id_auditoria, usuario, tabla_afectada, accion, valor_anterior, valor_nuevo, fecha").eq("tabla_afectada", "detalle_ventas").in("registro_id", detailIds) : Promise.resolve({ data: [], error: null }),
    paymentIds.length ? admin.from("auditoria").select("id_auditoria, usuario, tabla_afectada, accion, valor_anterior, valor_nuevo, fecha").eq("tabla_afectada", "pagos_venta").in("registro_id", paymentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (saleError || detailError || paymentError) throw new Error("No fue posible cargar la auditoría relacionada.");
  const entries = [...(saleAudit ?? []), ...(detailAudit ?? []), ...(paymentAudit ?? [])].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  const userIds = [...new Set(entries.map((entry) => entry.usuario).filter((value): value is number => value !== null))];
  const { data: users } = userIds.length ? await admin.from("usuarios").select("id_usuario, nombres, apellidos").in("id_usuario", userIds) : { data: [] };
  const userMap = new Map((users ?? []).map((user) => [user.id_usuario, `${user.nombres} ${user.apellidos}`.trim()]));
  const audit: SaleAuditEntry[] = entries.map((entry) => ({ id: entry.id_auditoria, action: entry.accion, table: entry.tabla_afectada, date: entry.fecha, user: entry.usuario ? userMap.get(entry.usuario) ?? `Usuario #${entry.usuario}` : "Sistema", previousValue: entry.valor_anterior as Record<string, unknown> | null, newValue: entry.valor_nuevo as Record<string, unknown> | null }));
  return { ...receipt, audit };
}

export async function getSaleWorkspaceContext() {
  const context = await requirePermission("VENTA_CREAR");
  const admin = createAdminClient();
  let locationsQuery = admin.from("locales").select("id_local, nombre").eq("activo", true).order("nombre");
  if (context.perfil !== ROLE_NAMES.ADMINISTRADOR && context.id_local) locationsQuery = locationsQuery.eq("id_local", context.id_local);
  const [{ data: locations, error }, { data: variants, error: variantsError }, { data: products, error: productsError }, { data: warehouses, error: warehousesError }, { data: stocks, error: stocksError }, { data: channels, error: channelsError }, { data: paymentMethods, error: paymentMethodsError }, { data: customers, error: customersError }] = await Promise.all([
    locationsQuery,
    admin.from("variantes_producto").select("id_variante, id_producto, codigo_interno, codigo_gs1, precio_venta, porcentaje_iva, imagen_url").eq("activo", true).order("codigo_interno"),
    admin.from("productos").select("id_producto, descripcion").eq("activo", true),
    admin.from("bodegas").select("id_bodega, id_local").eq("activo", true),
    admin.from("stock_producto").select("id_variante, id_bodega, cantidad"),
    admin.from("canales_venta").select("id_canal, codigo, nombre").eq("activo", true).order("id_canal"),
    admin.from("formas_pago").select("id_forma_pago, codigo, nombre, requiere_referencia").eq("activo", true).order("id_forma_pago"),
    admin.from("clientes").select("id_cliente, nombres, razon_social, identificacion").eq("activo", true).order("nombres").limit(200),
  ]);
  const requiredErrors = [error, variantsError, productsError, warehousesError, stocksError, channelsError, paymentMethodsError].filter(Boolean);
  if (requiredErrors.length) {
    console.error("SUPABASE sale workspace ERROR:", requiredErrors.map((item) => ({ code: item?.code, message: item?.message })));
    throw new Error("No fue posible preparar la venta.");
  }
  if (customersError) {
    console.warn("SUPABASE optional customers WARNING:", customersError.code, customersError.message);
  }
  const productNames = new Map((products ?? []).map((product) => [product.id_producto, product.descripcion]));
  const warehouseLocations = new Map((warehouses ?? []).map((warehouse) => [warehouse.id_bodega, warehouse.id_local]));
  const stockByVariant = new Map<number, Record<number, number>>();
  for (const stock of stocks ?? []) {
    const localId = warehouseLocations.get(stock.id_bodega);
    if (!localId) continue;
    const totals = stockByVariant.get(stock.id_variante) ?? {};
    totals[localId] = (totals[localId] ?? 0) + (Number(stock.cantidad) || 0);
    stockByVariant.set(stock.id_variante, totals);
  }
  const saleProducts: SaleProduct[] = (variants ?? []).flatMap((variant) => {
    const producto = productNames.get(variant.id_producto);
    const precio = Number(variant.precio_venta);
    if (!producto || !Number.isFinite(precio) || precio <= 0) return [];
    return [{ id_variante: variant.id_variante, id_producto: variant.id_producto, producto, codigo_interno: variant.codigo_interno, codigo_gs1: variant.codigo_gs1, precio, porcentaje_iva: Number(variant.porcentaje_iva) || 0, imagen_url: variant.imagen_url, stockPorLocal: stockByVariant.get(variant.id_variante) ?? {} }];
  });
  const saleCustomers: SaleCustomer[] = (customersError ? [] : customers ?? []).map((customer) => ({ id_cliente: customer.id_cliente, nombre: customer.razon_social || customer.nombres || customer.identificacion || "Cliente", identificacion: customer.identificacion }));
  return { context, locations: locations ?? [], products: saleProducts, channels: (channels ?? []) as SaleChannel[], paymentMethods: (paymentMethods ?? []) as SalePaymentMethod[], customers: saleCustomers };
}
