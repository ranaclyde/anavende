import { Decimal } from "decimal.js";

// TECHNICAL-SPEC §7.1: todo monto viaja como string. `parseFloat` y `Number()`
// sobre montos están prohibidos fuera de este módulo (lo hace cumplir el lint).
// Las sumas de verdad van en SQL; esto es para lo que no puede ocurrir en la
// base.

export type Money = string;

const ESCALA = 2;

// Hacia abajo: nadie paga de más por un redondeo.
Decimal.set({ rounding: Decimal.ROUND_DOWN });

const FORMATO_MONTO = /^-?\d{1,10}(\.\d{1,2})?$/;

export function isMoney(valor: unknown): valor is Money {
  return typeof valor === "string" && FORMATO_MONTO.test(valor);
}

/** De lo que escribe una persona («89.900,50») al formato del sistema. */
export function comoMonto(escrito: string): string {
  const limpio = escrito.trim();
  // Punto de miles solo si separa grupos de tres: «1.50» sigue siendo uno con
  // cincuenta.
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)) {
    return limpio.replaceAll(".", "").replace(",", ".");
  }
  return limpio.replace(",", ".");
}

/** «89900.00» → «89900»; «89900.50» → «89900,50». */
export function paraEditar(monto: Money): string {
  const [enteros, centavos = "00"] = money(monto).split(".");
  return centavos === "00" ? enteros : `${enteros},${centavos}`;
}

function aDecimal(valor: Money): Decimal {
  if (!isMoney(valor)) {
    throw new TypeError(
      `Monto mal formado: ${JSON.stringify(valor)}. Se esperaba una cadena con hasta dos decimales.`,
    );
  }
  return new Decimal(valor);
}

/** "1234.50". */
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

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return aDecimal(a).comparedTo(aDecimal(b)) as -1 | 0 | 1;
}

export function isZero(monto: Money): boolean {
  return aDecimal(monto).isZero();
}

export function isPositive(monto: Money): boolean {
  return aDecimal(monto).greaterThan(0);
}

/** Solo para previsualizar: en la base es la columna generada `final_price`. */
export function finalPrice(precio: Money, descuento: Money): Money {
  if (compare(descuento, precio) >= 0) {
    throw new RangeError(
      "El descuento tiene que ser menor que el precio (RN-04b).",
    );
  }
  return subtract(precio, descuento);
}

/**
 * RF-40. Hacia arriba a propósito, la única cuenta que no corta hacia abajo:
 * las cuotas tienen que sumar al menos el precio. `recargo` es un porcentaje.
 */
export function cuota(precio: Money, recargo: string, cuotas: number): Money {
  if (!Number.isInteger(cuotas) || cuotas < 2) {
    throw new RangeError(`Las cuotas tienen que ser 2 o más, llegó ${cuotas}.`);
  }
  if (!isMoney(recargo) || new Decimal(recargo).isNegative()) {
    throw new TypeError(`Recargo mal formado: ${JSON.stringify(recargo)}.`);
  }
  return aDecimal(precio)
    .times(new Decimal(recargo).dividedBy(100).plus(1))
    .dividedBy(cuotas)
    .toDecimalPlaces(ESCALA, Decimal.ROUND_UP)
    .toFixed(ESCALA);
}

const FORMATEADOR = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: ESCALA,
  maximumFractionDigits: ESCALA,
});

/** `"12500.5"` → `"$ 12.500,50"`, siempre con decimales (RN-02). */
export function formatMoney(monto: Money): string {
  return FORMATEADOR.format(Number(money(monto)));
}

// «$ 1,2 M», «$ 350 mil»: las marcas del eje de un gráfico.
const COMPACTO = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoneyCorto(monto: Money | number): string {
  return COMPACTO.format(
    typeof monto === "number" ? monto : Number(money(monto)),
  );
}

/** Para dibujar, nunca para sumar: no vuelve a la aritmética. */
export function paraDibujar(monto: Money): number {
  return Number(money(monto));
}

/**
 * Porcentaje entero contra el período anterior; `null` si el anterior no es
 * positivo.
 */
export function variacion(actual: Money, anterior: Money): number | null {
  const base = aDecimal(anterior);
  if (base.lessThanOrEqualTo(0)) return null;
  return aDecimal(actual)
    .minus(base)
    .dividedBy(base)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Porcentaje entero; `null` si el total no es positivo o la parte es negativa.
 */
export function porcentaje(parte: Money, total: Money): number | null {
  const t = aDecimal(total);
  const p = aDecimal(parte);
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
export function paraPlanilla(monto: Money): number {
  return Number(money(monto));
}
