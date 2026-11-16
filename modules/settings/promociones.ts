import { compare, cuota, isZero, type Money } from "@/lib/money";

/**
 * Qué promociones de cuotas muestra una ficha, y cuál va primero — RF-40,
 * F2.17.
 *
 * Lógica pura, sin base: la consulta trae las vigentes de toda la tienda una
 * vez por pedido (`promocionesVigentes`), y esto decide para un precio. Así
 * se prueba sin Postgres y la consulta no depende del producto, que es lo
 * que deja pedirla en paralelo con la ficha.
 */

/** Una promoción vigente, como la trae la consulta. */
export type PromocionVigente = {
  id: string;
  /** El nombre del medio de pago, como lo lee el comprador. */
  medio: string;
  cuotas: number;
  /** Porcentaje con dos decimales: `"0.00"` = sin interés. */
  recargo: string;
  montoMinimo: Money | null;
};

/** Lo que la ficha dibuja de cada una. */
export type PromocionDeLaFicha = {
  id: string;
  medio: string;
  cuotas: number;
  cuota: Money;
  sinRecargo: boolean;
};

export type PromocionesDeLaFicha = {
  /** La que va debajo del precio. `null` = no hay ninguna que aplique. */
  destacada: PromocionDeLaFicha | null;
  /** Las demás, detrás de «Ver más opciones», en el orden de los medios. */
  resto: PromocionDeLaFicha[];
};

/**
 * Filtra por monto mínimo, calcula la cuota y elige la destacada:
 *
 * 1. **La de más cuotas sin recargo**: es la que más alivia y la que no
 *    tiene letra chica.
 * 2. Si ninguna es sin recargo, **la de cuota más baja**.
 *
 * Los empates los gana la que llegó primero, que es el orden de los medios
 * de pago en el panel: lo que la vendedora puso arriba, va arriba.
 *
 * `vigentes` tiene que venir en ese orden (lo da la consulta); `resto` lo
 * conserva.
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
      cuotas: p.cuotas,
      cuota: cuota(precioFinal, p.recargo, p.cuotas),
      sinRecargo: isZero(p.recargo),
    });
  }

  let destacada: PromocionDeLaFicha | null = null;
  for (const p of aplican) {
    if (destacada === null || mejor(p, destacada)) destacada = p;
  }

  return {
    destacada,
    resto: aplican.filter((p) => p !== destacada),
  };
}

/** ¿`a` le gana a `b`? Estricto: en un empate se queda la que estaba. */
function mejor(a: PromocionDeLaFicha, b: PromocionDeLaFicha): boolean {
  if (a.sinRecargo !== b.sinRecargo) return a.sinRecargo;
  if (a.sinRecargo) return a.cuotas > b.cuotas;
  return compare(a.cuota, b.cuota) < 0;
}
