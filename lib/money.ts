import { Decimal } from "decimal.js";

/**
 * Aritmética y formato de montos — TECHNICAL-SPEC §7.1, riesgo R2.
 *
 * `numeric(12,2)` llega desde Drizzle como `string`, a propósito: convertirlo
 * a `number` pierde precisión y ese error no se ve hasta que una factura no
 * cierra por un centavo. Todo monto viaja como string por la aplicación.
 *
 * `parseFloat` y `Number()` sobre montos están PROHIBIDOS fuera de este
 * módulo, y la regla la hace cumplir el lint (eslint.config.mjs), no la buena
 * memoria de quien escribe.
 *
 * La suma de verdad se hace en SQL siempre que se pueda (§7.1): el total de
 * una orden es `SUM(order_items.subtotal)` dentro de la transacción, no una
 * reducción en JavaScript. Lo de acá es para los casos en que el cálculo no
 * puede ocurrir en la base: previsualizaciones en el formulario del panel y
 * subtotales que se muestran antes de confirmar.
 */

/** Un monto en pesos, tal como lo devuelve y lo espera Postgres. */
export type Money = string;

/** Dos decimales, sin excepción: la moneda del sistema es ARS. */
const ESCALA = 2;

// Se corta hacia abajo, nunca hacia arriba: nadie paga de más por un redondeo.
Decimal.set({ rounding: Decimal.ROUND_DOWN });

/** `numeric(12,2)`: hasta 10 dígitos enteros y exactamente 2 decimales. */
const FORMATO_MONTO = /^-?\d{1,10}(\.\d{1,2})?$/;

export function isMoney(valor: unknown): valor is Money {
  return typeof valor === "string" && FORMATO_MONTO.test(valor);
}

/**
 * Punto de entrada único. Rechaza cualquier cosa que no sea un monto
 * bien formado: es preferible un error acá que un `NaN` propagándose.
 */
function aDecimal(valor: Money): Decimal {
  if (!isMoney(valor)) {
    throw new TypeError(
      `Monto mal formado: ${JSON.stringify(valor)}. Se esperaba una cadena con hasta dos decimales.`,
    );
  }
  return new Decimal(valor);
}

/** Normaliza a la representación canónica de la base: "1234.50". */
export function money(valor: Money): Money {
  return aDecimal(valor).toFixed(ESCALA);
}

export const ZERO: Money = "0.00";

export function add(a: Money, b: Money): Money {
  return aDecimal(a).plus(aDecimal(b)).toFixed(ESCALA);
}

export function subtract(a: Money, b: Money): Money {
  return aDecimal(a).minus(aDecimal(b)).toFixed(ESCALA);
}

/** Monto por cantidad. La cantidad es un entero, no un monto. */
export function multiply(monto: Money, cantidad: number): Money {
  if (!Number.isInteger(cantidad)) {
    throw new TypeError(`La cantidad debe ser un entero, llegó ${cantidad}.`);
  }
  return aDecimal(monto).times(cantidad).toFixed(ESCALA);
}

export function sum(montos: readonly Money[]): Money {
  return montos
    .reduce((acc, m) => acc.plus(aDecimal(m)), new Decimal(0))
    .toFixed(ESCALA);
}

/** −1 si a < b, 0 si son iguales, 1 si a > b. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return aDecimal(a).comparedTo(aDecimal(b)) as -1 | 0 | 1;
}

export function isZero(monto: Money): boolean {
  return aDecimal(monto).isZero();
}

export function isPositive(monto: Money): boolean {
  return aDecimal(monto).greaterThan(0);
}

/**
 * Precio final y ahorro (RN-04b, §7.2).
 *
 * En la base esto es la columna generada `final_price` y NO se recalcula acá
 * (§7.1). Esta función existe para la previsualización en vivo del formulario
 * de producto (F2.3), donde todavía no hay fila en la base que consultar.
 */
export function finalPrice(precio: Money, descuento: Money): Money {
  if (compare(descuento, precio) >= 0) {
    throw new RangeError(
      "El descuento tiene que ser menor que el precio (RN-04b).",
    );
  }
  return subtract(precio, descuento);
}

// ── Formato ────────────────────────────────────────────────────────────
// La única capa donde un monto se convierte a número, y solo para mostrarlo.

const FORMATEADOR = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: ESCALA,
  maximumFractionDigits: ESCALA,
});

/**
 * `"12500.5"` → `"$ 12.500,50"`.
 * SIEMPRE con decimales (RN-02). Nunca se aclara nada sobre IVA
 * (DESIGN-REFERENCE §6.7).
 */
export function formatMoney(monto: Money): string {
  // Única conversión a número de todo el sistema. El lint la permite solo
  // en este archivo (eslint.config.mjs).
  return FORMATEADOR.format(Number(money(monto)));
}
