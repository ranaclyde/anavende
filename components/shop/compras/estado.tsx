import { Badge } from "@/components/ui/badge";
import type { EstadoOrden } from "@/modules/orders/estados";

/** Los nombres son para quien compró, no los de la base (FUNCTIONAL-SPEC RF-13). */
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
