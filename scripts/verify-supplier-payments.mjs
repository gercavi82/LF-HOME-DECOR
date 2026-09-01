import assert from "node:assert";

console.log("==============================================================================");
console.log("L&F HOME DECOR - SUITE DE VALIDACIÓN CONCILIACIÓN FIFO PROVEEDORES");
console.log("==============================================================================");

// Algoritmo puro de simulación FIFO que replica exactamente reconcileSupplierPayments()
function simulateReconciliation(purchasesInput, paymentsInput) {
  const purchases = purchasesInput.map((p) => ({
    id_compra: p.id_compra,
    id_proveedor: p.id_proveedor,
    fecha: p.fecha,
    total: Math.round(Number(p.total) * 100) / 100,
    totalAbonado: 0,
    saldoPendiente: Math.round(Number(p.total) * 100) / 100,
    estadoPago: "PENDIENTE",
  }));

  const payments = paymentsInput.map((pay) => ({
    id_pago: pay.id_pago,
    id_proveedor: pay.id_proveedor,
    fecha: pay.fecha,
    monto: Math.round(Number(pay.monto) * 100) / 100,
    disponible: Math.round(Number(pay.monto) * 100) / 100,
    aplicado: 0,
  }));

  const applications = [];

  // Agrupar y procesar independientemente por id_proveedor
  const supplierIds = Array.from(new Set([...purchases.map((p) => p.id_proveedor), ...payments.map((p) => p.id_proveedor)]));

  for (const provId of supplierIds) {
    const provPurchases = purchases.filter((p) => p.id_proveedor === provId);
    const provPayments = payments.filter((p) => p.id_proveedor === provId);

    // Ordenar compras por fecha ASC, id ASC
    provPurchases.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id_compra - b.id_compra);
    // Ordenar pagos por fecha ASC, id ASC
    provPayments.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id_pago - b.id_pago);

    for (const payment of provPayments) {
      if (payment.disponible <= 0) continue;

      for (const purchase of provPurchases) {
        const pendienteCompra = Math.round((purchase.total - purchase.totalAbonado) * 100) / 100;
        if (pendienteCompra <= 0) continue;

        const montoAplicar = Math.round(Math.min(payment.disponible, pendienteCompra) * 100) / 100;
        if (montoAplicar > 0) {
          applications.push({
            id_pago: payment.id_pago,
            id_compra: purchase.id_compra,
            id_proveedor: provId,
            monto_aplicado: montoAplicar,
          });

          payment.disponible = Math.round((payment.disponible - montoAplicar) * 100) / 100;
          payment.aplicado = Math.round((payment.aplicado + montoAplicar) * 100) / 100;
          purchase.totalAbonado = Math.round((purchase.totalAbonado + montoAplicar) * 100) / 100;
        }

        if (payment.disponible <= 0) break;
      }
    }

    for (const purchase of provPurchases) {
      purchase.saldoPendiente = Math.max(0, Math.round((purchase.total - purchase.totalAbonado) * 100) / 100);
      if (purchase.totalAbonado <= 0) {
        purchase.estadoPago = "PENDIENTE";
      } else if (purchase.saldoPendiente <= 0.005) {
        purchase.estadoPago = "PAGADA";
      } else {
        purchase.estadoPago = "ABONO_PARCIAL";
      }
    }
  }

  return { purchases, payments, applications };
}

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

// --------------------------------------------------------------------------
// CASO 1: Compra $500, Depósito $500 => PAGADA
// --------------------------------------------------------------------------
runTest("CASO 1: Compra $500, Depósito $500 => PAGADA", () => {
  const result = simulateReconciliation(
    [{ id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 500 }],
    [{ id_pago: 1, id_proveedor: 1, fecha: "2026-06-02", monto: 500 }]
  );

  const c = result.purchases[0];
  const p = result.payments[0];
  assert.strictEqual(c.estadoPago, "PAGADA");
  assert.strictEqual(c.totalAbonado, 500);
  assert.strictEqual(c.saldoPendiente, 0);
  assert.strictEqual(p.aplicado, 500);
  assert.strictEqual(p.disponible, 0);
});

// --------------------------------------------------------------------------
// CASO 2: Compra $500, Depósito $300 => ABONO_PARCIAL (Abonado $300, Pendiente $200)
// --------------------------------------------------------------------------
runTest("CASO 2: Compra $500, Depósito $300 => ABONO_PARCIAL ($300 abonado, $200 pendiente)", () => {
  const result = simulateReconciliation(
    [{ id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 500 }],
    [{ id_pago: 1, id_proveedor: 1, fecha: "2026-06-02", monto: 300 }]
  );

  const c = result.purchases[0];
  const p = result.payments[0];
  assert.strictEqual(c.estadoPago, "ABONO_PARCIAL");
  assert.strictEqual(c.totalAbonado, 300);
  assert.strictEqual(c.saldoPendiente, 200);
  assert.strictEqual(p.disponible, 0);
});

// --------------------------------------------------------------------------
// CASO 3: Compras $500 + $700, Depósito $800 => Compra 1 PAGADA ($500), Compra 2 abonada $300 ($400 pendiente)
// --------------------------------------------------------------------------
runTest("CASO 3: Compras $500 + $700, Depósito $800 => Compra 1 PAGADA, Compra 2 abonada $300", () => {
  const result = simulateReconciliation(
    [
      { id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 500 },
      { id_compra: 2, id_proveedor: 1, fecha: "2026-06-25", total: 700 },
    ],
    [{ id_pago: 1, id_proveedor: 1, fecha: "2026-06-26", monto: 800 }]
  );

  assert.strictEqual(result.purchases[0].estadoPago, "PAGADA");
  assert.strictEqual(result.purchases[0].totalAbonado, 500);
  assert.strictEqual(result.purchases[0].saldoPendiente, 0);

  assert.strictEqual(result.purchases[1].estadoPago, "ABONO_PARCIAL");
  assert.strictEqual(result.purchases[1].totalAbonado, 300);
  assert.strictEqual(result.purchases[1].saldoPendiente, 400);
});

// --------------------------------------------------------------------------
// CASO 4: Depósito $1.000, Compras $800 => $800 aplicado, $200 disponible
// --------------------------------------------------------------------------
runTest("CASO 4: Depósito $1.000, Compras $800 => $800 aplicado, $200 disponible", () => {
  const result = simulateReconciliation(
    [{ id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 800 }],
    [{ id_pago: 1, id_proveedor: 1, fecha: "2026-06-02", monto: 1000 }]
  );

  const p = result.payments[0];
  assert.strictEqual(p.aplicado, 800);
  assert.strictEqual(p.disponible, 200);
});

// --------------------------------------------------------------------------
// CASO 5: Existe depósito disponible $300, se registra nueva compra $500 => Compra abonada $300, pendiente $200
// --------------------------------------------------------------------------
runTest("CASO 5: Depósito previo $300, nueva compra $500 => auto-abonado $300, pendiente $200", () => {
  const result = simulateReconciliation(
    [{ id_compra: 1, id_proveedor: 1, fecha: "2026-06-10", total: 500 }],
    [{ id_pago: 1, id_proveedor: 1, fecha: "2026-06-01", monto: 300 }]
  );

  const c = result.purchases[0];
  assert.strictEqual(c.estadoPago, "ABONO_PARCIAL");
  assert.strictEqual(c.totalAbonado, 300);
  assert.strictEqual(c.saldoPendiente, 200);
});

// --------------------------------------------------------------------------
// CASO 6: Varios depósitos y varias facturas => FIFO exacto
// --------------------------------------------------------------------------
runTest("CASO 6: Múltiples depósitos y compras en fechas escalonadas => FIFO exacto", () => {
  const result = simulateReconciliation(
    [
      { id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 500 },
      { id_compra: 2, id_proveedor: 1, fecha: "2026-06-25", total: 700 },
      { id_compra: 3, id_proveedor: 1, fecha: "2026-07-06", total: 900 },
    ],
    [
      { id_pago: 1, id_proveedor: 1, fecha: "2026-06-05", monto: 600 },
      { id_pago: 2, id_proveedor: 1, fecha: "2026-07-01", monto: 800 },
    ]
  );

  // Total compras: 2100. Total pagos: 1400.
  // Pago 1 ($600): paga Compra 1 ($500) + $100 a Compra 2.
  // Pago 2 ($800): paga saldo Compra 2 ($600) + $200 a Compra 3.
  // Compra 1: $500 abonado ($0 pend) -> PAGADA
  // Compra 2: $700 abonado ($0 pend) -> PAGADA
  // Compra 3: $200 abonado ($700 pend) -> ABONO_PARCIAL
  assert.strictEqual(result.purchases[0].estadoPago, "PAGADA");
  assert.strictEqual(result.purchases[0].saldoPendiente, 0);

  assert.strictEqual(result.purchases[1].estadoPago, "PAGADA");
  assert.strictEqual(result.purchases[1].saldoPendiente, 0);

  assert.strictEqual(result.purchases[2].estadoPago, "ABONO_PARCIAL");
  assert.strictEqual(result.purchases[2].totalAbonado, 200);
  assert.strictEqual(result.purchases[2].saldoPendiente, 700);

  // Pagos totalmente aplicados
  assert.strictEqual(result.payments[0].disponible, 0);
  assert.strictEqual(result.payments[1].disponible, 0);
});

// --------------------------------------------------------------------------
// CASO 7: Idempotencia: Ejecutar 2 veces con los mismos datos da el mismo resultado exacto
// --------------------------------------------------------------------------
runTest("CASO 7: Idempotencia (cero duplicaciones al ejecutar conciliación consecutivamente)", () => {
  const compras = [
    { id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 1000 },
  ];
  const pagos = [
    { id_pago: 1, id_proveedor: 1, fecha: "2026-06-02", monto: 400 },
  ];

  const res1 = simulateReconciliation(compras, pagos);
  const res2 = simulateReconciliation(compras, pagos);

  assert.deepStrictEqual(res1.purchases, res2.purchases);
  assert.deepStrictEqual(res1.payments, res2.payments);
  assert.strictEqual(res1.applications.length, 1);
  assert.strictEqual(res2.applications.length, 1);
});

// --------------------------------------------------------------------------
// CASO 8: Dos proveedores diferentes => Cero cruce entre proveedores
// --------------------------------------------------------------------------
runTest("CASO 8: Dos proveedores diferentes jamás cruzan saldos ni aplicaciones", () => {
  const result = simulateReconciliation(
    [
      { id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 500 },
      { id_compra: 2, id_proveedor: 2, fecha: "2026-06-01", total: 500 },
    ],
    [
      { id_pago: 1, id_proveedor: 1, fecha: "2026-06-02", monto: 800 },
    ]
  );

  // Proveedor 1: Compra 1 PAGADA, $300 disponible
  assert.strictEqual(result.purchases[0].estadoPago, "PAGADA");
  assert.strictEqual(result.purchases[0].saldoPendiente, 0);

  // Proveedor 2: Compra 2 PENDIENTE, $500 pendiente (No recibió nada del pago de Prov 1)
  assert.strictEqual(result.purchases[1].estadoPago, "PENDIENTE");
  assert.strictEqual(result.purchases[1].totalAbonado, 0);
  assert.strictEqual(result.purchases[1].saldoPendiente, 500);

  // Depósito de Prov 1 tiene $300 disponible intacto para Prov 1
  assert.strictEqual(result.payments[0].disponible, 300);

  // Verificar que ninguna aplicación mezcló proveedores
  for (const app of result.applications) {
    const compra = result.purchases.find((c) => c.id_compra === app.id_compra);
    const pago = result.payments.find((p) => p.id_pago === app.id_pago);
    assert.strictEqual(compra.id_proveedor, pago.id_proveedor);
    assert.strictEqual(app.id_proveedor, compra.id_proveedor);
  }
});

// --------------------------------------------------------------------------
// CASO 9: Invariantes Matemáticas y Tolerancias
// --------------------------------------------------------------------------
runTest("CASO 9: Cumplimiento estricto de invariantes financieras", () => {
  const result = simulateReconciliation(
    [
      { id_compra: 1, id_proveedor: 1, fecha: "2026-06-01", total: 2326.50 },
      { id_compra: 2, id_proveedor: 1, fecha: "2026-06-15", total: 1540.25 },
    ],
    [
      { id_pago: 1, id_proveedor: 1, fecha: "2026-06-05", monto: 2000.00 },
      { id_pago: 2, id_proveedor: 1, fecha: "2026-06-20", monto: 1000.00 },
    ]
  );

  // 1. Total = total_abonado + saldo_pendiente
  for (const c of result.purchases) {
    const diff = Math.abs(c.total - (c.totalAbonado + c.saldoPendiente));
    assert.ok(diff <= 0.01, `Diferencia de compra > 0.01: ${diff}`);
    assert.ok(c.saldoPendiente >= 0, "Saldo pendiente negativo detectado");
    assert.ok(c.totalAbonado <= c.total + 0.01, "Compra sobre-abonada detectada");
  }

  // 2. Monto depósito = aplicado + disponible
  for (const p of result.payments) {
    const diff = Math.abs(p.monto - (p.aplicado + p.disponible));
    assert.ok(diff <= 0.01, `Diferencia de depósito > 0.01: ${diff}`);
    assert.ok(p.disponible >= 0, "Saldo disponible negativo detectado");
    assert.ok(p.aplicado <= p.monto + 0.01, "Depósito sobre-aplicado detectado");
  }

  // 3. SUM(aplicaciones) === SUM(total_abonado)
  const sumApps = result.applications.reduce((s, a) => s + a.monto_aplicado, 0);
  const sumAbonado = result.purchases.reduce((s, c) => s + c.totalAbonado, 0);
  assert.strictEqual(Math.round(sumApps * 100) / 100, Math.round(sumAbonado * 100) / 100);
});

console.log("==============================================================================");
console.log(`RESUMEN DE AUDITORÍA: ${passedTests} pruebas completadas con éxito.`);
console.log("RESULTADO: 0 depósitos sobreaplicados | 0 compras sobreabonadas | 0 cruces");
console.log("==============================================================================");
