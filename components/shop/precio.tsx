import { formatMoney, isPositive, type Money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Precio — F3.2, DESIGN-REFERENCE §6.7, RN-02, RN-04b.
 *
 * Componente propio y no tres clases sueltas repetidas en cada pantalla: el
 * precio aparece en la tarjeta, en la ficha, en el carrito y en la orden, y
 * una oferta que en un lugar se ve burdeos y en otro no es la clase de
 * inconsistencia que nadie reporta y todos notan.
 *
 * **No formatea: usa `formatMoney`.** Los montos viajan como texto (`Money`)
 * de punta a punta —§7.2— y `lib/money.ts` es la ÚNICA capa donde se
 * convierten a número, solo para mostrarlos. Un `Intl.NumberFormat` acá sería
 * un segundo formateador con su propia opinión sobre los decimales, y además
 * construido en cada render: en una grilla de 24 productos, 24 veces.
 *
 * Es un Server Component: no tiene estado ni eventos, así que no hay motivo
 * para mandar su código al navegador.
 */

type Props = {
  /** Precio de lista, antes del descuento. */
  precio: Money;
  /** Monto descontado (RN-04b: monto, nunca porcentaje). `"0.00"` si no hay. */
  descuento: Money;
  /** `precio − descuento`, calculado en la base (columna generada §5.4). */
  precioFinal: Money;
  /**
   * `tarjeta` en la grilla, `ficha` en el detalle del producto (§7.3, donde el
   * precio sube a 24px y es lo primero que se lee después del nombre).
   */
  tamano?: "tarjeta" | "ficha";
  className?: string;
};

export function Precio({
  precio,
  descuento,
  precioFinal,
  tamano = "tarjeta",
  className,
}: Props) {
  const hayOferta = isPositive(descuento);
  const enFicha = tamano === "ficha";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {/*
        `tabular-nums` en todos los montos: sin esto las columnas de precios de
        la grilla bailan, porque en Inter el «1» es más angosto que el «8».
      */}
      <p
        className={cn(
          "font-semibold tabular-nums",
          enFicha ? "text-title" : "text-body",
          // El burdeos es de la marca y de lo accionable (§11). Acá señala una
          // oferta vigente, que es la única excepción que §6.7 le concede.
          hayOferta ? "text-brand" : "text-ink",
        )}
      >
        {formatMoney(precioFinal)}
      </p>

      {hayOferta ? (
        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-2",
            enFicha ? "gap-y-1" : "gap-y-0.5",
          )}
        >
          {/*
            `<s>` y no una clase de tachado: el tachado ES la información —«este
            precio ya no rige»— y un lector de pantalla no ve `line-through`.
            El «Antes:» oculto evita que se lean dos precios seguidos sin decir
            cuál es cuál, que es como suena sin él.
          */}
          <s className="text-caption text-ink-tertiary tabular-nums">
            <span className="sr-only">Antes: </span>
            {formatMoney(precio)}
          </s>

          {/*
            El descuento se comunica como MONTO ahorrado, nunca como porcentaje
            (RN-04b). «Ahorrás $ 3.000» es una plata concreta; «11% off» hay que
            calcularlo mentalmente sobre un número que todavía no se leyó.
          */}
          <p
            className={cn(
              "font-medium text-brand tabular-nums",
              enFicha ? "text-body-sm" : "text-caption",
            )}
          >
            Ahorrás {formatMoney(descuento)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
