"use client";

import {
  Calendar,
  Clock3,
  CreditCard,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Save,
  CheckCircle2,
} from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Gs1Scanner } from "@/src/components/products/gs1-scanner";
import { Alert, Badge, Button, Input, Spinner } from "@/src/components/ui";
import { createSaleAction, createQuickCustomerAction, type SaleActionState } from "@/app/(protected)/ventas/nueva/actions";
import { calculateIncludedTax } from "@/src/lib/tax";
import type { SaleChannel, SaleCustomer, SalePaymentMethod, SaleProduct } from "@/src/services/sales/sales";

type CartItem = SaleProduct & {
  cantidad: number;
  descuento: number;
};
type PaymentPart = { key: number; methodId: number; value: number; reference: string };
const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const initialActionState: SaleActionState = {};

function calculateCart(items: CartItem[], globalDiscount: number) {
  const grossCents = items.reduce((total, item) => total + Math.round(item.precio * 100) * item.cantidad, 0);
  const itemsDiscountCents = items.reduce((sum, item) => sum + Math.round((item.descuento || 0) * 100), 0);
  const extraGlobalCents = Math.max(0, Math.round(globalDiscount * 100));
  const totalDiscountCents = Math.min(grossCents, itemsDiscountCents + extraGlobalCents);
  
  let allocated = 0;
  let subtotalCents = 0;
  let taxCents = 0;

  items.forEach((item, index) => {
    const lineGross = Math.round(item.precio * 100) * item.cantidad;
    const itemDirectDiscount = Math.min(lineGross, Math.round((item.descuento || 0) * 100));
    
    let lineDiscount = itemDirectDiscount;
    if (extraGlobalCents > 0) {
      const remainingGlobal = totalDiscountCents - itemsDiscountCents;
      const isLast = index === items.length - 1;
      const lineExtra = isLast 
        ? remainingGlobal - (allocated - itemsDiscountCents)
        : grossCents ? Math.round((remainingGlobal * lineGross) / grossCents) : 0;
      lineDiscount = Math.min(lineGross, itemDirectDiscount + Math.max(0, lineExtra));
    }
    allocated += lineDiscount;

    const breakdown = calculateIncludedTax((lineGross - lineDiscount) / 100, item.porcentaje_iva);
    subtotalCents += Math.round(breakdown.subtotal * 100);
    taxCents += Math.round(breakdown.tax * 100);
  });

  return {
    gross: grossCents / 100,
    discount: totalDiscountCents / 100,
    subtotal: subtotalCents / 100,
    tax: taxCents / 100,
    total: Math.max(0, (grossCents - totalDiscountCents) / 100),
  };
}

export function SaleWorkspace({
  locations = [],
  products = [],
  channels = [],
  paymentMethods = [],
  customers = [],
  sellers = [],
  currentUser,
  defaultLocation,
  defaultChannelCode,
}: {
  locations: Array<{ id_local: number; nombre: string }>;
  products: SaleProduct[];
  channels: SaleChannel[];
  paymentMethods: SalePaymentMethod[];
  customers: SaleCustomer[];
  sellers?: Array<{ id_usuario: number; nombre: string; perfil: string }>;
  currentUser?: { id_usuario: number; perfil: string; nombres: string; apellidos: string } | null;
  defaultLocation: number | null;
  defaultChannelCode: string;
}) {
  const [actionState, formAction, pending] = useActionState(createSaleAction, initialActionState);
  const [elapsed, setElapsed] = useState(0);
  const [locationId, setLocationId] = useState(defaultLocation || locations[0]?.id_local || 1);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  
  const todayStr = new Date().toISOString().slice(0, 10);
  const [saleDate, setSaleDate] = useState(todayStr);

  const [sellerId, setSellerId] = useState<number>(
    currentUser?.id_usuario || sellers[0]?.id_usuario || 1
  );

  const [customerList, setCustomerList] = useState<SaleCustomer[]>(customers);
  const [customerId, setCustomerId] = useState<number>(0);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustIdent, setNewCustIdent] = useState("");
  const [newCustNombres, setNewCustNombres] = useState("");
  const [newCustApellidos, setNewCustApellidos] = useState("");
  const [newCustTelefono, setNewCustTelefono] = useState("");
  const [newCustCorreo, setNewCustCorreo] = useState("");
  const [newCustDireccion, setNewCustDireccion] = useState("");
  const [customerPending, startCustomerTransition] = useTransition();
  const [customerModalError, setCustomerModalError] = useState<string>();

  const [channelId, setChannelId] = useState(
    channels.find((channel) => channel.codigo === defaultChannelCode)?.id_canal ?? channels[0]?.id_canal ?? 1
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods.find((method) => method.codigo === "EFECTIVO")?.id_forma_pago ?? paymentMethods[0]?.id_forma_pago ?? 1
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [observations, setObservations] = useState("");
  const simplePaymentMethods = paymentMethods.filter((method) => method.codigo !== "MIXTO");
  const [paymentParts, setPaymentParts] = useState<PaymentPart[]>(() => [
    { key: 1, methodId: simplePaymentMethods[0]?.id_forma_pago ?? 1, value: 0, reference: "" },
    { key: 2, methodId: simplePaymentMethods[1]?.id_forma_pago ?? simplePaymentMethods[0]?.id_forma_pago ?? 1, value: 0, reference: "" },
  ]);
  const [message, setMessage] = useState<string>();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const availableProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = product.stockPorLocal[locationId] ?? product.stockPorLocal[1] ?? 10;
      return stock > 0;
    });
  }, [products, locationId]);

  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return [];
    return availableProducts
      .filter(
        (product) =>
          product.producto.toLocaleLowerCase("es").includes(term) ||
          product.codigo_interno.toLocaleLowerCase("es").includes(term) ||
          product.codigo_gs1?.includes(term.replace(/[\s-]/g, ""))
      )
      .slice(0, 8);
  }, [availableProducts, search]);

  const totals = useMemo(() => calculateCart(cart, discount), [cart, discount]);
  const selectedPaymentMethod = paymentMethods.find((method) => method.id_forma_pago === paymentMethodId);
  const isMixed = selectedPaymentMethod?.codigo === "MIXTO";
  const mixedPaidCents = paymentParts.reduce((sum, part) => sum + Math.round(part.value * 100), 0);
  const totalCents = Math.round(totals.total * 100);
  const referencesValid = paymentParts.every((part) => {
    const method = paymentMethods.find((item) => item.id_forma_pago === part.methodId);
    return !method?.requiere_referencia || part.reference.trim().length >= 3;
  });
  const mixedMethodsAreDifferent = new Set(paymentParts.map((part) => part.methodId)).size >= 2;
  const paymentValid =
    Boolean(selectedPaymentMethod) &&
    (isMixed
      ? paymentParts.length >= 2 &&
        mixedMethodsAreDifferent &&
        paymentParts.every((part) => part.value > 0 && part.methodId > 0) &&
        mixedPaidCents === totalCents &&
        referencesValid
      : !selectedPaymentMethod?.requiere_referencia || paymentReference.trim().length >= 3);

  const paymentPayload = isMixed
    ? paymentParts.map((part) => ({
        id_forma_pago: part.methodId,
        valor: Math.round(part.value * 100) / 100,
        referencia: part.reference.trim() || null,
      }))
    : selectedPaymentMethod
    ? [
        {
          id_forma_pago: selectedPaymentMethod.id_forma_pago,
          valor: totals.total,
          referencia: paymentReference.trim() || null,
        },
      ]
    : [];

  const payload = JSON.stringify({
    id_local: locationId || 1,
    id_cliente: customerId || null,
    id_canal: channelId || 1,
    id_usuario_asesor: sellerId || null,
    fecha: saleDate || null,
    descuento: totals.discount,
    observaciones: observations,
    items: cart.map((item) => ({
      id_variante: item.id_variante,
      cantidad: item.cantidad,
      descuento: item.descuento || 0,
    })),
    pagos: paymentPayload,
  });

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustIdent.trim() || !newCustNombres.trim()) {
      setCustomerModalError("La identificación y el nombre son obligatorios.");
      return;
    }
    setCustomerModalError(undefined);

    startCustomerTransition(async () => {
      const res = await createQuickCustomerAction({
        identificacion: newCustIdent.trim(),
        nombres: newCustNombres.trim(),
        apellidos: newCustApellidos.trim(),
        telefono: newCustTelefono.trim(),
        correo: newCustCorreo.trim(),
        direccion: newCustDireccion.trim(),
      });

      if (res.success && res.customer) {
        const newCust: SaleCustomer = {
          id_cliente: res.customer.id_cliente,
          identificacion: res.customer.identificacion,
          nombre: res.customer.nombre,
          name: res.customer.nombre,
        };
        setCustomerList((prev) => [newCust, ...prev]);
        setCustomerId(newCust.id_cliente);
        setShowCustomerModal(false);
        setNewCustIdent("");
        setNewCustNombres("");
        setNewCustApellidos("");
        setNewCustTelefono("");
        setNewCustCorreo("");
        setNewCustDireccion("");
      } else {
        setCustomerModalError(res.error || "No se pudo registrar el cliente.");
      }
    });
  };

  const addProduct = useCallback(
    (product: SaleProduct) => {
      const stock = product.stockPorLocal[locationId] ?? product.stockPorLocal[1] ?? 99;
      setCart((current) => {
        const existing = current.find((item) => item.id_variante === product.id_variante);
        if (existing && existing.cantidad >= stock) {
          setMessage(`Stock insuficiente para ${product.producto}. Disponible: ${stock}.`);
          return current;
        }
        setMessage(undefined);
        return existing
          ? current.map((item) =>
              item.id_variante === product.id_variante
                ? { ...item, cantidad: item.cantidad + 1 }
                : item
            )
          : [...current, { ...product, cantidad: 1, descuento: 0 }];
      });
      setSearch("");
      searchRef.current?.focus();
    },
    [locationId]
  );

  const scanDetected = useCallback(
    (code: string) => {
      const normalized = code.trim().toLocaleLowerCase("es");
      const product = availableProducts.find(
        (item) => item.codigo_interno.toLocaleLowerCase("es") === normalized || item.codigo_gs1 === code
      );
      if (product) addProduct(product);
      else setMessage("El código escaneado no está activo o no tiene stock en este local.");
    },
    [availableProducts, addProduct]
  );

  function changeQuantity(id: number, next: number) {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.id_variante !== id) return [item];
        const stock = item.stockPorLocal[locationId] ?? item.stockPorLocal[1] ?? 99;
        if (next <= 0) return [];
        if (next > stock) {
          setMessage(`Stock insuficiente. Disponible: ${stock}.`);
          return [item];
        }
        setMessage(undefined);
        return [{ ...item, cantidad: next }];
      })
    );
  }

  function changeItemDiscount(id: number, desc: number) {
    setCart((current) =>
      current.map((item) =>
        item.id_variante === id
          ? { ...item, descuento: Math.min(item.precio * item.cantidad, Math.max(0, desc || 0)) }
          : item
      )
    );
  }

  function changeLocation(nextLocation: number) {
    if (cart.length && !window.confirm("Cambiar el local vaciará el carrito. ¿Desea continuar?")) return;
    setLocationId(nextLocation);
    setCart([]);
    setDiscount(0);
    setMessage(undefined);
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
      <input type="hidden" name="payload" value={payload} />
      <section className="rounded-2xl border bg-lf-surface p-4 shadow-[var(--lf-shadow-sm)] sm:p-6">
        {actionState.error ? <Alert variant="danger" className="mb-4">{actionState.error}</Alert> : null}
        {message ? <Alert variant="warning" className="mb-4">{message}</Alert> : null}
        <div className="relative flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar producto</span>
            <Search size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lf-muted" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  event.preventDefault();
                  addProduct(matches[0]);
                }
              }}
              placeholder="Buscar o escanear código interno / GS1..."
              className="h-12 w-full rounded-xl border bg-white pl-11 pr-4 outline-none focus:border-lf-terracotta focus:ring-2 focus:ring-lf-terracotta/20"
            />
          </label>
          <Gs1Scanner onDetected={scanDetected} />
          {matches.length ? (
            <div className="absolute left-0 right-0 top-14 z-20 max-h-80 overflow-y-auto rounded-xl border bg-white p-2 shadow-[var(--lf-shadow-md)] sm:right-28">
              {matches.map((product) => (
                <button
                  key={product.id_variante}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-lf-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{product.producto}</span>
                    <span className="block font-mono text-xs text-lf-muted">
                      {product.codigo_interno}
                      {product.codigo_gs1 ? ` · GS1 ${product.codigo_gs1}` : ""} · Stock{" "}
                      {product.stockPorLocal[locationId] ?? product.stockPorLocal[1] ?? 10}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-lf-terracotta">{currency.format(product.precio)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {cart.length ? (
          <div className="mt-5 space-y-3">
            {cart.map((item) => {
              const isWholesale = item.cantidad >= 3;
              const lineTotal = Math.max(0, item.precio * item.cantidad - (item.descuento || 0));

              return (
                <article
                  key={item.id_variante}
                  className={`flex flex-col gap-3 rounded-xl border p-3.5 transition sm:flex-row sm:items-center ${
                    isWholesale ? "border-emerald-300 bg-emerald-50/30" : "bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-lf-navy">{item.producto}</h3>
                      <Badge variant="neutral">IVA {item.porcentaje_iva}%</Badge>
                      {isWholesale ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <Tag size={11} /> Mayorista (≥3 uds)
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs text-lf-muted mt-0.5">
                      {item.codigo_interno}
                      {item.codigo_gs1 ? ` · GS1 ${item.codigo_gs1}` : ""} · {currency.format(item.precio)} c/u · Stock{" "}
                      {item.stockPorLocal[locationId] ?? item.stockPorLocal[1] ?? 10}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-end">
                    {/* Cantidad Stepper */}
                    <div className="flex items-center rounded-xl border bg-white">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id_variante, item.cantidad - 1)}
                        className="grid size-9 place-items-center text-slate-600 hover:text-lf-terracotta"
                        aria-label="Restar cantidad"
                      >
                        <Minus size={15} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stockPorLocal[locationId] ?? item.stockPorLocal[1] ?? 99}
                        value={item.cantidad}
                        onChange={(event) => changeQuantity(item.id_variante, Number(event.target.value))}
                        className="h-9 w-12 border-x text-center font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.id_variante, item.cantidad + 1)}
                        className="grid size-9 place-items-center text-slate-600 hover:text-lf-terracotta"
                        aria-label="Sumar cantidad"
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    {/* Casilla de Descuento por Ítem */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500 font-medium whitespace-nowrap">Desc:</span>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          max={item.precio * item.cantidad}
                          step="0.5"
                          value={item.descuento || ""}
                          onChange={(e) => changeItemDiscount(item.id_variante, Number(e.target.value))}
                          placeholder="0.00"
                          title="Descuento en dólares para este producto"
                          className="h-9 w-20 rounded-xl border bg-white pl-5 pr-2 text-right text-xs font-semibold outline-none focus:border-lf-terracotta"
                        />
                      </div>
                    </div>

                    {/* Total de Línea */}
                    <span className="w-20 text-right font-bold text-lf-navy">
                      {currency.format(lineTotal)}
                    </span>

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={() =>
                        setCart((current) =>
                          current.filter((product) => product.id_variante !== item.id_variante)
                        )
                      }
                      className="grid size-9 place-items-center rounded-lg text-lf-danger hover:bg-[var(--lf-danger-soft)]"
                      aria-label={`Eliminar ${item.producto}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 grid min-h-72 place-items-center rounded-2xl border border-dashed bg-lf-surface-muted/50 text-center">
            <div>
              <ShoppingCart size={36} className="mx-auto text-lf-muted" />
              <p className="mt-3 font-semibold">Carrito vacío</p>
              <p className="mt-1 max-w-sm text-sm text-lf-muted">Busca un producto o escanea su GS1 para comenzar.</p>
            </div>
          </div>
        )}
      </section>

      <aside className="h-fit rounded-2xl border bg-lf-surface p-5 shadow-[var(--lf-shadow-sm)] xl:sticky xl:top-24">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Resumen de venta</h2>
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              elapsed <= 30 ? "text-lf-success" : "text-lf-warning"
            }`}
          >
            <Clock3 size={15} /> {elapsed}s
          </span>
        </div>
        {/* Fecha de Venta */}
        <label className="mt-4 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lf-muted">
            <Calendar size={14} className="text-lf-terracotta" /> Fecha de venta
          </span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            max={todayStr}
            className="h-10 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-lf-terracotta shadow-2xs"
          />
        </label>

        {/* Local */}
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-lf-muted">Local</span>
          <select
            value={locationId || ""}
            onChange={(event) => changeLocation(Number(event.target.value))}
            className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta shadow-2xs"
          >
            <option value="" disabled>
              Seleccionar
            </option>
            {locations.map((location) => (
              <option key={location.id_local} value={location.id_local}>
                {location.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* Asesor / Vendedor Responsable */}
        <label className="mt-3 block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-lf-muted">
            <UserCheck size={14} className="text-lf-navy" /> Asesor / Vendedor
          </span>
          <select
            value={sellerId}
            onChange={(event) => setSellerId(Number(event.target.value))}
            className="h-10 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-lf-terracotta shadow-2xs"
          >
            {sellers.map((s) => (
              <option key={s.id_usuario} value={s.id_usuario}>
                {s.nombre} ({s.perfil})
              </option>
            ))}
          </select>
        </label>

        {/* Cliente con botón para crear nuevo */}
        <div className="mt-3 block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-lf-muted">Cliente</span>
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-lf-terracotta/10 px-2 py-0.5 text-xs font-bold text-lf-terracotta hover:bg-lf-terracotta/20 transition"
            >
              <UserPlus size={12} /> + Nuevo cliente
            </button>
          </div>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(Number(event.target.value))}
            className="h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-lf-terracotta shadow-2xs"
          >
            <option value={0}>Consumidor final (9999999999999)</option>
            {customerList.map((customer) => (
              <option key={customer.id_cliente} value={customer.id_cliente}>
                {customer.nombre} {customer.identificacion ? ` · ${customer.identificacion}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Canales de Venta */}
        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-lf-muted">Canal de venta</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-2">
            {channels.map((channel) => (
              <button
                key={channel.id_canal}
                type="button"
                onClick={() => setChannelId(channel.id_canal)}
                aria-pressed={channelId === channel.id_canal}
                className={`min-h-9 rounded-xl border px-2 text-xs font-semibold transition ${
                  channelId === channel.id_canal
                    ? "border-lf-terracotta bg-lf-terracotta text-white shadow-sm"
                    : "bg-white hover:bg-lf-surface-muted"
                }`}
              >
                {channel.nombre}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="mb-2 flex items-center gap-2 text-sm font-medium">
            <CreditCard size={16} /> Forma de pago
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id_forma_pago}
                type="button"
                onClick={() => {
                  setPaymentMethodId(method.id_forma_pago);
                  setPaymentReference("");
                }}
                aria-pressed={paymentMethodId === method.id_forma_pago}
                className={`min-h-10 rounded-xl border px-2 text-xs font-semibold transition ${
                  paymentMethodId === method.id_forma_pago
                    ? "border-lf-navy bg-lf-navy text-white"
                    : "bg-white hover:bg-lf-surface-muted"
                }`}
              >
                {method.nombre}
              </button>
            ))}
          </div>
        </fieldset>
        {selectedPaymentMethod?.requiere_referencia && !isMixed ? (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-medium">Referencia</span>
            <input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              minLength={3}
              maxLength={150}
              placeholder="Número de comprobante"
              className="h-11 w-full rounded-xl border bg-white px-3.5 outline-none focus:border-lf-terracotta"
            />
          </label>
        ) : null}
        {isMixed ? (
          <div className="mt-3 space-y-2 rounded-xl bg-lf-surface-muted p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Distribución del pago</p>
              <span
                className={`text-xs font-semibold ${
                  mixedPaidCents === totalCents ? "text-lf-success" : "text-lf-warning"
                }`}
              >
                Falta {currency.format(Math.max(0, (totalCents - mixedPaidCents) / 100))}
              </span>
            </div>
            {paymentParts.map((part) => {
              const method = paymentMethods.find((item) => item.id_forma_pago === part.methodId);
              return (
                <div key={part.key} className="rounded-xl border bg-white p-2">
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <select
                      value={part.methodId}
                      onChange={(event) =>
                        setPaymentParts((parts) =>
                          parts.map((item) =>
                            item.key === part.key
                              ? { ...item, methodId: Number(event.target.value), reference: "" }
                              : item
                          )
                        )
                      }
                      className="h-10 min-w-0 flex-1 rounded-lg border px-2 text-xs"
                    >
                      {simplePaymentMethods.map((item) => (
                        <option key={item.id_forma_pago} value={item.id_forma_pago}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={part.value || ""}
                      onChange={(event) =>
                        setPaymentParts((parts) =>
                          parts.map((item) =>
                            item.key === part.key
                              ? { ...item, value: Math.max(0, Number(event.target.value)) }
                              : item
                          )
                        )
                      }
                      placeholder="$0.00"
                      className="h-10 w-24 rounded-lg border px-2 text-sm"
                    />
                    {paymentParts.length > 2 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentParts((parts) => parts.filter((item) => item.key !== part.key))
                        }
                        className="grid size-10 place-items-center text-lf-danger"
                      >
                        <X size={15} />
                      </button>
                    ) : null}
                  </div>
                  {method?.requiere_referencia ? (
                    <input
                      value={part.reference}
                      onChange={(event) =>
                        setPaymentParts((parts) =>
                          parts.map((item) =>
                            item.key === part.key ? { ...item, reference: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Referencia"
                      className="mt-2 h-9 w-full rounded-lg border px-2 text-xs"
                    />
                  ) : null}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setPaymentParts((parts) => [
                  ...parts,
                  {
                    key: Date.now(),
                    methodId: simplePaymentMethods[0]?.id_forma_pago ?? 0,
                    value: 0,
                    reference: "",
                  },
                ])
              }
              className="h-9 w-full rounded-lg border bg-white text-xs font-semibold"
            >
              + Agregar otro pago
            </button>
          </div>
        ) : null}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium">Observaciones</span>
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-lf-terracotta"
          />
        </label>
        <dl className="mt-5 space-y-3 border-y py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-lf-muted">Prendas / Productos</dt>
            <dd>{cart.reduce((sum, item) => sum + item.cantidad, 0)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-lf-muted">Bruto</dt>
            <dd>{currency.format(totals.gross)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-lf-muted">Descuento Total</dt>
              <dd className="text-emerald-700 font-semibold">−{currency.format(totals.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-lf-muted">Subtotal</dt>
            <dd>{currency.format(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-lf-muted">IVA</dt>
            <dd>{currency.format(totals.tax)}</dd>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <dt>Total a Cobrar</dt>
            <dd className="text-lf-terracotta">{currency.format(totals.total)}</dd>
          </div>
        </dl>
        <button
          type="submit"
          disabled={pending || !cart.length || totals.total <= 0 || !channelId || !paymentValid}
          className="mt-5 h-12 w-full rounded-xl bg-lf-terracotta font-semibold text-white hover:bg-lf-terracotta-hover disabled:opacity-50 transition shadow-sm"
        >
          {pending ? "Confirmando..." : "Confirmar venta"}
        </button>
        <p className="mt-3 text-center text-xs text-lf-muted">
          La venta se registra completa o se revierte automáticamente.
        </p>
      </aside>

      {/* Modal de Registro Rápido de Nuevo Cliente */}
      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-lf-terracotta/10 text-lf-terracotta">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lf-navy">Registrar Nuevo Cliente</h3>
                  <p className="text-xs text-lf-muted">Datos para facturación y contacto.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCustomerModal(false);
                  setCustomerModalError(undefined);
                }}
                className="rounded-lg p-1 text-lf-muted hover:bg-lf-surface-muted hover:text-lf-navy"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {customerModalError ? <Alert variant="danger">{customerModalError}</Alert> : null}

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-700">Cédula o RUC *</span>
                <input
                  value={newCustIdent}
                  onChange={(e) => setNewCustIdent(e.target.value)}
                  placeholder="Ej: 1712345678"
                  maxLength={13}
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Nombres *</span>
                  <input
                    value={newCustNombres}
                    onChange={(e) => setNewCustNombres(e.target.value)}
                    placeholder="Ej: Juan"
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Apellidos</span>
                  <input
                    value={newCustApellidos}
                    onChange={(e) => setNewCustApellidos(e.target.value)}
                    placeholder="Ej: Pérez"
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Teléfono</span>
                  <input
                    value={newCustTelefono}
                    onChange={(e) => setNewCustTelefono(e.target.value)}
                    placeholder="Ej: 0991234567"
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Correo</span>
                  <input
                    type="email"
                    value={newCustCorreo}
                    onChange={(e) => setNewCustCorreo(e.target.value)}
                    placeholder="cliente@email.com"
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-700">Dirección</span>
                <input
                  value={newCustDireccion}
                  onChange={(e) => setNewCustDireccion(e.target.value)}
                  placeholder="Ej: Av. Principal y Secundaria"
                  className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-lf-terracotta"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerModal(false);
                    setCustomerModalError(undefined);
                  }}
                  className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-lf-surface-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={customerPending}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lf-terracotta px-4 text-sm font-semibold text-white hover:bg-lf-terracotta-hover transition disabled:opacity-50"
                >
                  {customerPending ? "Guardando..." : <><Save size={15} /> Guardar cliente</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}


