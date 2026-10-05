import { cn } from "@/lib/utils";

/**
 * La muestra de color de una variante — DESIGN-REFERENCE §6.5.
 *
 * Una variante puede ser de dos colores («Negro/Rojo», decidido el
 * 2026-10-05), y entonces la esfera va **partida en diagonal**: el primero
 * arriba a la izquierda, el segundo abajo a la derecha. Es un solo
 * componente para todas las pantallas que muestran una variante —tarjeta,
 * ficha, panel— porque cinco círculos escritos a mano eran cinco lugares
 * donde el segundo color se podía olvidar.
 *
 * El corte va de abajo a la izquierda a arriba a la derecha, y no al revés, a
 * propósito: «sin stock» en la ficha es una barra en la otra diagonal (§6.5),
 * y si las dos coincidieran, una esfera partida se leería como agotada.
 *
 * Es decorativa siempre: quien la usa pone el nombre del color en texto, al
 * lado o en `sr-only`.
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
        "block shrink-0 rounded-full border border-border",
        className,
      )}
      style={{ background: fondoDeColor(hex, hex2) }}
    />
  );
}

/**
 * Corte neto, sin degradé: `50%` y `50%` en el mismo punto. Un degradé entre
 * negro y rojo dibujaría un tercer color —un bordó— que el producto no tiene.
 */
export function fondoDeColor(hex: string, hex2?: string | null): string {
  return hex2 ? `linear-gradient(135deg, ${hex} 50%, ${hex2} 50%)` : hex;
}
