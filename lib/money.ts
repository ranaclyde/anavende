import { Decimal } from "decimal.js";

// TECHNICAL-SPEC §7.1: todo monto viaja como string. `parseFloat` y `Number()`
// sobre montos están prohibidos fuera de este módulo (lo hace cumplir el lint).
// Las sumas de verdad van en SQL; esto es para lo que no puede ocurrir en la
// base.

export type Money = string;

const SCALE = 2;

// Hacia abajo: nadie paga de más por un redondeo.
Decimal.set({ rounding: Decimal.ROUND_DOWN });

const MONEY_FORMAT = /^-?\d{1,10}(\.\d{1,2})?$/;

export function isMoney(value: unknown): value is Money {
  return typeof value === "string" && MONEY_FORMAT.test(value);
}

/** De lo que escribe una persona («89.900,50») al formato del sistema. */
export function normalizeAmount(input: string): string {
  const trimmed = input.trim();
  // Punto de miles solo si separa grupos de tres: «1.50» sigue siendo uno con
  // cincuenta.
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(trimmed)) {
    return trimmed.replaceAll(".", "").replace(",", ".");
  }
  return trimmed.replace(",", ".");
}

/** «89900.00» → «89900»; «89900.50» → «89900,50». */
export function toEditable(amount: Money): string {
  const [whole, cents = "00"] = money(amount).split(".");
  return cents === "00" ? whole : `${whole},${cents}`;
}

function toDecimal(value: Money): Decimal {
  if (!isMoney(value)) {
    throw new TypeError(
      `Monto mal formado: ${JSON.stringify(value)}. Se esperaba una cadena con hasta dos decimales.`,
    );
  }
  return new Decimal(value);
}

/** "1234.50". */
export function money(value: Money): Money {
  return toDecimal(value).toFixed(SCALE);
}

export const ZERO: Money = "0.00";

export function add(a: Money, b: Money): Money {
  return toDecimal(a).plus(toDecimal(b)).toFixed(SCALE);
}

export function subtract(a: Money, b: Money): Money {
  return toDecimal(a).minus(toDecimal(b)).toFixed(SCALE);
}

export function multiply(amount: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new TypeError(`La cantidad debe ser un entero, llegó ${quantity}.`);
  }
  return toDecimal(amount).times(quantity).toFixed(SCALE);
}

export function sum(amounts: readonly Money[]): Money {
  return amounts
    .reduce((acc, m) => acc.plus(toDecimal(m)), new Decimal(0))
    .toFixed(SCALE);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return toDecimal(a).comparedTo(toDecimal(b)) as -1 | 0 | 1;
}

export function isZero(amount: Money): boolean {
  return toDecimal(amount).isZero();
}

export function isPositive(amount: Money): boolean {
  return toDecimal(amount).greaterThan(0);
}

/**
 * RF-40. Hacia arriba a propósito, la única cuenta que no corta hacia abajo:
 * las cuotas tienen que sumar al menos el precio. `surcharge` es un porcentaje.
 */
export function installment(
  price: Money,
  surcharge: string,
  installments: number,
): Money {
  if (!Number.isInteger(installments) || installments < 2) {
    throw new RangeError(
      `Las cuotas tienen que ser 2 o más, llegó ${installments}.`,
    );
  }
  if (!isMoney(surcharge) || new Decimal(surcharge).isNegative()) {
    throw new TypeError(`Recargo mal formado: ${JSON.stringify(surcharge)}.`);
  }
  return toDecimal(price)
    .times(new Decimal(surcharge).dividedBy(100).plus(1))
    .dividedBy(installments)
    .toDecimalPlaces(SCALE, Decimal.ROUND_UP)
    .toFixed(SCALE);
}

const FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: SCALE,
  maximumFractionDigits: SCALE,
});

/** `"12500.5"` → `"$ 12.500,50"`, siempre con decimales (RN-02). */
export function formatMoney(amount: Money): string {
  return FORMATTER.format(Number(money(amount)));
}

// «$ 1,2 M», «$ 350 mil»: las marcas del eje de un gráfico.
const COMPACT = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoneyShort(amount: Money | number): string {
  return COMPACT.format(
    typeof amount === "number" ? amount : Number(money(amount)),
  );
}

/** Para dibujar, nunca para sumar: no vuelve a la aritmética. */
export function toChartNumber(amount: Money): number {
  return Number(money(amount));
}

/**
 * Porcentaje entero contra el período anterior; `null` si el anterior no es
 * positivo.
 */
export function percentChange(current: Money, previous: Money): number | null {
  const base = toDecimal(previous);
  if (base.lessThanOrEqualTo(0)) return null;
  return toDecimal(current)
    .minus(base)
    .dividedBy(base)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Porcentaje entero; `null` si el total no es positivo o la parte es negativa.
 */
export function percentOf(part: Money, total: Money): number | null {
  const t = toDecimal(total);
  const p = toDecimal(part);
  if (t.lessThanOrEqualTo(0) || p.lessThan(0)) return null;
  return p
    .dividedBy(t)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Para una celda de Excel, que sin número no se suma. Nunca vuelve a la
 * aritmética.
 */
export function toSpreadsheetNumber(amount: Money): number {
  return Number(money(amount));
}
