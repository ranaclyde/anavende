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
   *
   * Las dos muestran **los mismos dos números** —cuánto valía y cuánto vale—:
   * lo que cambia es la disposición, no la información. El renglón «Ahorrás
   * $ X» se fue de las dos por decisión del 2026-09-08 (DR §14).
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

  /*
   * DOS NÚMEROS, ACÁ Y EN LA FICHA. La tarjeta llegó a mostrar la píldora
   * «−$ 9.900» sobre la imagen, el final, el tachado y «Ahorrás $ 9.900»: la
   * misma cifra dos veces para comunicar una sola oferta. Quedan los dos que
   * dicen cosas distintas —cuánto valía y cuánto vale—, y el tachado va
   * primero, como se lee un cartel de oferta.
   *
   * Lo que separa las dos variantes es la DISPOSICIÓN. En la grilla el precio
   * comparte renglón con los puntos de color y tiene que entrar en una línea;
   * en la ficha es lo primero que se lee después del nombre, sube a 24px y el
   * tachado pasa abajo, donde no le compite.
   */
  if (!enFicha) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
          className,
        )}
      >
        {/*
          El tachado va PRIMERO, como se lee un cartel de oferta: «valía tanto,
          ahora tanto». Con el final adelante, el tachado parece una aclaración
          al pie y se pierde el contraste entre los dos.

          `<s>` y no una clase: el tachado ES la información —«este precio ya no
          rige»— y un lector de pantalla no ve `line-through`. El «Antes:»
          oculto evita que se lean dos precios seguidos sin decir cuál es cuál.
        */}
        {hayOferta ? (
          <s className="text-caption text-ink-tertiary tabular-nums">
            <span className="sr-only">Antes: </span>
            {formatMoney(precio)}
          </s>
        ) : null}

        {/*
          `tabular-nums`: sin esto las columnas de precios de la grilla bailan,
          porque en Inter el «1» es más angosto que el «8».
        */}
        <p
          className={cn(
            "text-body font-semibold tabular-nums",
            // El burdeos es de la marca y de lo accionable (§11). Acá señala
            // una oferta vigente, la única excepción que §6.7 le concede.
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
          "text-title font-semibold tabular-nums",
          hayOferta ? "text-brand" : "text-ink",
        )}
      >
        {formatMoney(precioFinal)}
      </p>

      {/*
        El descuento NO se enuncia: se muestra. El tachado arriba del final
        dice cuánto bajó sin obligar a leer un tercer número, y jamás se
        expresa como porcentaje (RN-04b) — «11% off» hay que calcularlo
        mentalmente sobre un monto que todavía no se leyó.
      */}
      {hayOferta ? (
        <s className="text-caption text-ink-tertiary tabular-nums">
          <span className="sr-only">Antes: </span>
          {formatMoney(precio)}
        </s>
      ) : null}
    </div>
  );
}
