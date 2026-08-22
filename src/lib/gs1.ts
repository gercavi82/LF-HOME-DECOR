export const GS1_LENGTHS = [8, 12, 13, 14] as const;

export function normalizeGs1(value: string) {
  return value.replace(/[\s-]/g, "");
}

export function isValidGs1(value: string) {
  const code = normalizeGs1(value);
  if (!/^\d+$/.test(code) || !GS1_LENGTHS.includes(code.length as (typeof GS1_LENGTHS)[number])) return false;
  const digits = [...code].map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return checkDigit === (10 - (sum % 10)) % 10;
}

export function gs1ValidationMessage(value: string) {
  const code = normalizeGs1(value);
  if (!code) return null;
  if (!/^\d+$/.test(code)) return "El código GS1 solo puede contener números.";
  if (!GS1_LENGTHS.includes(code.length as (typeof GS1_LENGTHS)[number])) return "Use un GTIN-8, UPC-A/GTIN-12, EAN-13 o GTIN-14.";
  if (!isValidGs1(code)) return "El dígito verificador del código GS1 no es válido.";
  return null;
}
