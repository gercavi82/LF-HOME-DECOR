export type TaxBreakdown = { subtotal: number; tax: number; total: number; rate: number };

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Desglosa un precio que ya incluye IVA y garantiza subtotal + IVA = total. */
export function calculateIncludedTax(totalValue: number, rateValue: number): TaxBreakdown {
  const totalCents = Math.max(0, Math.round((Number(totalValue) || 0) * 100));
  const rate = Math.min(100, Math.max(0, Number(rateValue) || 0));
  const subtotalCents = rate === 0 ? totalCents : Math.round((totalCents * 100) / (100 + rate));
  const taxCents = totalCents - subtotalCents;
  return { subtotal: subtotalCents / 100, tax: taxCents / 100, total: totalCents / 100, rate };
}
