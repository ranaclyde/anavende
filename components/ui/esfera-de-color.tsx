import { cn } from "@/lib/utils";

/**
 * Muestra de color de una variante; con dos colores va partida en diagonal
 * (DR §6.5). El corte es el opuesto a la barra de «sin stock», para que una
 * esfera partida no se lea como agotada.
 *
 * Decorativa: quien la usa pone el nombre del color en texto o en `sr-only`.
 */
export function EsferaDeColor({
  hex,
  hex2,
  className,
}: {
  hex: string;
  /** `null` o ausente = la variante es de un solo color. */
  hex2?: string | null;
  /** Tamaño, y el borde si la pantalla pide otro. */
  className?: string;
}) {
  return (
    <span
      aria-hidden
      // El borde importa en los claros: un punto blanco sobre superficie
      // blanca, sin contorno, no existe.
      className={cn(
        "block shrink-0 rounded-full border border-ink/30",
        className,
      )}
      style={{ background: fondoDeColor(hex, hex2) }}
    />
  );
}

/** Corte neto: un degradé dibujaría un tercer color que el producto no tiene. */
export function fondoDeColor(hex: string, hex2?: string | null): string {
  return hex2 ? `linear-gradient(135deg, ${hex} 50%, ${hex2} 50%)` : hex;
}
