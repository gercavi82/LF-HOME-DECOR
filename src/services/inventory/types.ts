import { z } from "zod";

/**
 * Catálogo oficial de tipos de movimiento de inventario.
 * Ningún otro tipo debe ser admitido en el sistema.
 */
export const INVENTORY_MOVEMENT_TYPES = [
  "INICIAL",
  "COMPRA",
  "VENTA",
  "DEVOLUCION_CLIENTE",
  "DEVOLUCION_PROVEEDOR",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRANSFERENCIA_ENTRADA",
  "TRANSFERENCIA_SALIDA",
] as const;

export const inventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES);
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;

/**
 * Movimientos que suman al inventario físico (factor +1)
 */
export const INCOMING_MOVEMENT_TYPES: ReadonlySet<InventoryMovementType> = new Set([
  "INICIAL",
  "COMPRA",
  "DEVOLUCION_CLIENTE",
  "AJUSTE_ENTRADA",
  "TRANSFERENCIA_ENTRADA",
]);

/**
 * Movimientos que restan al inventario físico (factor -1)
 */
export const OUTGOING_MOVEMENT_TYPES: ReadonlySet<InventoryMovementType> = new Set([
  "VENTA",
  "DEVOLUCION_PROVEEDOR",
  "AJUSTE_SALIDA",
  "TRANSFERENCIA_SALIDA",
]);

/**
 * Obtiene el factor multiplicador (+1 o -1) del tipo de movimiento.
 */
export function getMovementFactor(type: InventoryMovementType): 1 | -1 {
  if (INCOMING_MOVEMENT_TYPES.has(type)) return 1;
  if (OUTGOING_MOVEMENT_TYPES.has(type)) return -1;
  throw new Error(`Tipo de movimiento de inventario no reconocido: ${type}`);
}

/**
 * Mapeo de sinónimos históricos hacia el catálogo oficial.
 */
export function normalizeMovementType(rawType: string): InventoryMovementType {
  const upper = (rawType || "").trim().toUpperCase();
  switch (upper) {
    case "INICIAL":
    case "ENTRADA_INICIAL":
      return "INICIAL";
    case "COMPRA":
    case "ENTRADA":
    case "INGRESO":
      return "COMPRA";
    case "VENTA":
    case "SALIDA":
      return "VENTA";
    case "DEVOLUCION_CLIENTE":
    case "DEVOLUCION_VENTA":
    case "REVERSO_VENTA":
      return "DEVOLUCION_CLIENTE";
    case "DEVOLUCION_PROVEEDOR":
    case "DEVOLUCION_COMPRA":
    case "REVERSO_COMPRA":
      return "DEVOLUCION_PROVEEDOR";
    case "AJUSTE_ENTRADA":
    case "AJUSTE_SOBRANTE":
    case "CORRECCION_ENTRADA":
      return "AJUSTE_ENTRADA";
    case "AJUSTE_SALIDA":
    case "AJUSTE_FALTANTE":
    case "PERDIDA":
    case "DANO":
    case "DANADO":
    case "CORRECCION_SALIDA":
      return "AJUSTE_SALIDA";
    case "TRANSFERENCIA_ENTRADA":
      return "TRANSFERENCIA_ENTRADA";
    case "TRANSFERENCIA_SALIDA":
      return "TRANSFERENCIA_SALIDA";
    default:
      if (inventoryMovementTypeSchema.safeParse(upper).success) {
        return upper as InventoryMovementType;
      }
      throw new Error(`Tipo de movimiento no válido: ${rawType}`);
  }
}
