import { Badge } from "@/components/ui/badge";
import type { EstadoOrden } from "@/modules/orders/estados";
import type { OrigenDeOrden } from "@/modules/orders/queries-panel";

/**
 * En el panel, los estados se llaman como en la máquina de estados; la tienda
 * los traduce para el comprador («En preparación», «Entregada»).
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

/** Sólo se etiqueta la excepción, la manual: «Web» en cada fila sería ruido. */
export function OrigenDeLaOrden({ origen }: { origen: OrigenDeOrden }) {
  if (origen === "web") return null;
  return <Badge tone="warning">Manual</Badge>;
}
