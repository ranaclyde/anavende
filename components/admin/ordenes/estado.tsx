import { Badge } from "@/components/ui/badge";
import type { EstadoOrden } from "@/modules/orders/estados";
import type { OrigenDeOrden } from "@/modules/orders/queries-panel";

/**
 * Las dos etiquetas de una orden en el panel — DR §6.4. Tarea F7.1.
 *
 * **Acá los estados se llaman como en la máquina de estados**, al revés de
 * lo que hace la tienda: para el comprador, `activa` es «En preparación» y
 * `finalizada` es «Entregada» (F6.5), porque ésas son las palabras de lo que
 * le está pasando. Para la vendedora, activa y finalizada son exactamente lo
 * que dicen —y son las palabras de los botones que las cambian (F7.3)—, así
 * que traducirlas acá sería inventar un segundo vocabulario para el mismo
 * trabajo.
 */
const ESTADOS = {
  activa: { texto: "Activa", tono: "info" },
  finalizada: { texto: "Finalizada", tono: "success" },
  cancelada: { texto: "Cancelada", tono: "neutral" },
} as const satisfies Record<
  EstadoOrden,
  { texto: string; tono: "info" | "success" | "neutral" }
>;

export function EstadoDeLaOrden({ estado }: { estado: EstadoOrden }) {
  const { texto, tono } = ESTADOS[estado];
  return <Badge tone={tono}>{texto}</Badge>;
}

/** La misma palabra, para un texto corrido o un `aria-label`. */
export function nombreDelEstado(estado: EstadoOrden): string {
  return ESTADOS[estado].texto;
}

/**
 * El origen, y **sólo cuando es manual**.
 *
 * Casi todas las órdenes son de la web: una etiqueta «Web» en cada fila sería
 * ruido repetido cuarenta veces por pantalla, y lo que hay que ver de un
 * vistazo es la excepción. Es la misma razón por la que el listado de
 * productos no etiqueta «Con stock».
 */
export function OrigenDeLaOrden({ origen }: { origen: OrigenDeOrden }) {
  if (origen === "web") return null;
  return <Badge tone="warning">Manual</Badge>;
}
