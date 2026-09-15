import { Badge } from "@/components/ui/badge";
import type { EstadoOrden } from "@/modules/orders/estados";

/**
 * El estado de una orden, como lo ve el comprador — RF-13, DR §6.4.
 * Tarea F6.5.
 *
 * **Los nombres no son los de la base.** `activa` es lenguaje del sistema;
 * para quien compró, esa orden está **«En preparación»**, que es lo que
 * efectivamente está pasando. `finalizada` se dice **«Entregada»** por lo
 * mismo: finalizar es lo que hace la vendedora en el panel, recibirla es lo
 * que le pasa a él. El panel de F7.1 sí va a nombrarlas como la máquina de
 * estados, porque ahí el vocabulario del sistema es el vocabulario del
 * trabajo.
 *
 * Los tonos son los que `badge.tsx` ya tenía anotados para cada estado.
 */
const ESTADOS = {
  activa: { texto: "En preparación", tono: "info" },
  finalizada: { texto: "Entregada", tono: "success" },
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
