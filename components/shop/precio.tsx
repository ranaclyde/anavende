import { formatMoney, isPositive, type Money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Precio (DESIGN-REFERENCE §6.7). Formatea solo con `formatMoney`: es la única
 * capa que convierte los montos a número (RN-02).
 */

type Props = {
  /** Precio de lista, antes del descuento. */
  precio: Money;
  /** Monto descontado, nunca porcentaje (RN-04b). `"0.00"` si no hay. */
  descuento: Money;
  /** `precio − descuento`, columna generada en la base. */
  precioFinal: Money;
  tamano?: "tarjeta" | "ficha";
  /**
   * Solo para `tarjeta`: el tachado en su propio renglón, reservado aunque no
   * haya oferta, para que los precios de una fila queden a la misma altura.
   */
  apilado?: boolean;
  className?: string;
};

export function Precio({
  precio,
  descuento,
  precioFinal,
  tamano = "tarjeta",
  apilado = false,
  className,
}: Props) {
  const hayOferta = isPositive(descuento);
  const enFicha = tamano === "ficha";

  if (!enFicha && apilado) {
    return (
      <div className={cn("@container flex min-w-0 flex-col", className)}>
        {hayOferta ? (
          <s className="text-caption text-ink-secondary tabular-nums">
            <span className="sr-only">Antes: </span>
            {formatMoney(precio)}
          </s>
        ) : (
          <span aria-hidden className="text-caption">
            &nbsp;
          </span>
        )}
        <p
          className={cn(
            // Contra el ancho de la tarjeta: a 18px, siete cifras no entran en
            // un teléfono de 320px. Así toda la fila queda del mismo tamaño.
            "text-[clamp(0.875rem,13cqi,1.125rem)] leading-[1.45] font-medium tracking-[-0.015em] tabular-nums",
            hayOferta ? "text-brand" : "text-ink",
          )}
        >
          {formatMoney(precioFinal)}
        </p>
      </div>
    );
  }

  if (!enFicha) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
          className,
        )}
      >
        {/* `<s>` y no una clase: un lector de pantalla no ve `line-through`. */}
        {hayOferta ? (
          <s className="text-caption text-ink-secondary tabular-nums">
            <span className="sr-only">Antes: </span>
            {formatMoney(precio)}
          </s>
        ) : null}

        {/* Precio final. */}
        <p
          className={cn(
            "text-body font-semibold tabular-nums",
            hayOferta ? "text-brand" : "text-ink",
          )}
        >
          {formatMoney(precioFinal)}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <p
        className={cn(
          // A mano: no hay token entre `title` y `display`.
          "text-[1.75rem] leading-[1.15] font-medium tracking-[-0.03em] tabular-nums",
          hayOferta ? "text-brand" : "text-ink",
        )}
      >
        {formatMoney(precioFinal)}
      </p>

      {/* Nunca como porcentaje (RN-04b). */}
      {hayOferta ? (
        <s className="text-caption text-ink-secondary tabular-nums">
          <span className="sr-only">Antes: </span>
          {formatMoney(precio)}
        </s>
      ) : null}
    </div>
  );
}
