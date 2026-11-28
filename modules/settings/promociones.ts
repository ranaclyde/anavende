import { compare, installment, isZero, type Money } from "@/lib/money";

// Lógica pura: la consulta no depende del producto, así se pide en paralelo con
// la ficha y esto decide para cada precio.

export type PromocionVigente = {
  id: string;
  medio: string;
  /** `null` = la promoción es del medio entero. */
  plan: string | null;
  logoUrl: string | null;
  cuotas: number;
  /** Porcentaje con dos decimales: `"0.00"` = sin interés. */
  recargo: string;
  montoMinimo: Money | null;
};

export type PromocionDeLaFicha = {
  id: string;
  medio: string;
  plan: string | null;
  logoUrl: string | null;
  cuotas: number;
  cuota: Money;
  sinRecargo: boolean;
};

export type PromocionesDeLaFicha = {
  destacada: PromocionDeLaFicha | null;
  /** Primero las sin recargo; cada grupo de menos a más cuotas. */
  todas: PromocionDeLaFicha[];
};

/**
 * Destacada: la de más cuotas sin recargo; si no hay, la de cuota más baja.
 * Los empates los gana la primera, así que `vigentes` tiene que venir en el
 * orden de los medios de pago.
 */
export function promocionesParaElPrecio(
  vigentes: readonly PromocionVigente[],
  precioFinal: Money,
): PromocionesDeLaFicha {
  const aplican: PromocionDeLaFicha[] = [];
  for (const p of vigentes) {
    if (p.montoMinimo !== null && compare(precioFinal, p.montoMinimo) < 0) {
      continue;
    }
    aplican.push({
      id: p.id,
      medio: p.medio,
      plan: p.plan,
      logoUrl: p.logoUrl,
      cuotas: p.cuotas,
      cuota: installment(precioFinal, p.recargo, p.cuotas),
      sinRecargo: isZero(p.recargo),
    });
  }

  let destacada: PromocionDeLaFicha | null = null;
  for (const p of aplican) {
    if (destacada === null || mejor(p, destacada)) destacada = p;
  }

  // `toSorted` es estable: lo que empata conserva el orden de los medios.
  const todas = aplican.toSorted((a, b) =>
    a.sinRecargo !== b.sinRecargo
      ? a.sinRecargo
        ? -1
        : 1
      : a.cuotas - b.cuotas,
  );

  return { destacada, todas };
}

/** Estricto: en un empate se queda la que estaba. */
function mejor(a: PromocionDeLaFicha, b: PromocionDeLaFicha): boolean {
  if (a.sinRecargo !== b.sinRecargo) return a.sinRecargo;
  if (a.sinRecargo) return a.cuotas > b.cuotas;
  return compare(a.cuota, b.cuota) < 0;
}

/** «NaranjaX» o «Plan Z de NaranjaX». */
export function conQuien(
  p: Pick<PromocionDeLaFicha, "medio" | "plan">,
): string {
  return p.plan ? `${p.plan} de ${p.medio}` : p.medio;
}
