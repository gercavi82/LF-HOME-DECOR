/**
 * Utilidades de fecha y hora sincronizadas con la zona horaria oficial de Ecuador (America/Guayaquil - UTC-5).
 */

export const ECUADOR_TIMEZONE = "America/Guayaquil";

/**
 * Retorna la fecha actual o especificada en la zona horaria de Ecuador en formato YYYY-MM-DD.
 */
export function getEcuadorDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Retorna el año y mes en formato YYYY-MM según la hora de Ecuador.
 */
export function getEcuadorMonthString(date: Date = new Date()): string {
  return getEcuadorDateString(date).slice(0, 7);
}

/**
 * Retorna la hora en formato HH:mm:ss según la hora local de Ecuador.
 */
export function getEcuadorTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Retorna la fecha y hora en formato SQL 'YYYY-MM-DD HH:mm:ss' según la hora local de Ecuador.
 */
export function getEcuadorDateTimeString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Formatea cualquier valor de fecha (string de BD o Date) a 'YYYY-MM-DD' en hora de Ecuador.
 */
export function formatEcuadorDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string") {
    const clean = date.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      return clean.slice(0, 10);
    }
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return getEcuadorDateString(parsed);
    }
    return clean.slice(0, 10);
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return getEcuadorDateString(date);
  }
  return "";
}
