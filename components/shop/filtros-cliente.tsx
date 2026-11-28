"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  rutaDeTienda,
  urlCambiando,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { useAvisarFiltrando } from "@/components/shop/filtrando";
import { Slider } from "@/components/ui/slider";
import { FILTER_TYPE } from "@/lib/transitions";
import { cn } from "@/lib/utils";

const ESPERA = 700;

/** Pesos enteros, o `null` si el campo está vacío o no es un número. */
function aPesos(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number.parseInt(texto, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const aTexto = (n: number | null) => (n === null ? "" : String(n));

/** Los precios finales extremos del catálogo, en pesos enteros. */
export type LimitesDePrecio = { min: number; max: number };

/** Unos cien pasos redondos entre punta y punta: de a $ 1, la manija no se lee. */
function pasoPara({ min, max }: LimitesDePrecio): number {
  const rango = max - min;
  if (rango <= 100) return 1;
  return 10 ** (Math.floor(Math.log10(rango)) - 2);
}

const pesos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/**
 * El rango de precio, sin «Aplicar»: se aplica tras la espera, con Enter o al
 * salir del campo. Con `replace`, para no dejar una entrada del historial por
 * pausa. Sin JavaScript sigue siendo un formulario GET.
 *
 * Con «Desde» mayor que «Hasta» la espera no aplica: se darían vuelta los dos
 * campos a mitad de escribir («Hasta 2» camino a 20.000).
 */
export function RangoDePrecio({
  filtros,
  limites,
}: {
  filtros: FiltrosDeTienda;
  /** `null` con el catálogo vacío o un solo precio: no hay nada que deslizar. */
  limites: LimitesDePrecio | null;
}) {
  const router = useRouter();
  // La transición avisa cuándo termina: mientras, la grilla se atenúa.
  const [pendiente, iniciar] = useTransition();
  useAvisarFiltrando(pendiente);
  const [desde, setDesde] = useState(aTexto(filtros.precioMin));
  const [hasta, setHasta] = useState(aTexto(filtros.precioMax));
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Si el precio cambia desde afuera, los campos lo siguen. Al renderizar y no
  // con un efecto, que pintaría una vez el valor viejo. Si el cambio salió de
  // estos campos no se toca, para no pisar lo que se está tipeando.
  const [previo, setPrevio] = useState([filtros.precioMin, filtros.precioMax]);
  if (previo[0] !== filtros.precioMin || previo[1] !== filtros.precioMax) {
    setPrevio([filtros.precioMin, filtros.precioMax]);
    if (aPesos(desde) !== filtros.precioMin)
      setDesde(aTexto(filtros.precioMin));
    if (aPesos(hasta) !== filtros.precioMax)
      setHasta(aTexto(filtros.precioMax));
  }

  useEffect(() => () => clearTimeout(espera.current), []);

  const aplicar = (d: string, h: string, aunInvertido: boolean) => {
    clearTimeout(espera.current);
    let min = aPesos(d);
    let max = aPesos(h);
    if (min !== null && max !== null && min > max) {
      if (!aunInvertido) return;
      // Acá también, o la dirección y los campos dirían lo contrario.
      [min, max] = [max, min];
    }
    if (min === filtros.precioMin && max === filtros.precioMax) return;
    iniciar(() => {
      router.replace(
        urlCambiando(filtros, { precioMin: min, precioMax: max }),
        { scroll: false, transitionTypes: FILTER_TYPE },
      );
    });
  };

  const alEscribir = (d: string, h: string) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(d, h, false), ESPERA);
  };

  // Una manija en su punta es «sin límite»: si no, mover solo la de abajo
  // dejaría un tope que nadie eligió y un producto nuevo más caro afuera.
  const paso = limites ? pasoPara(limites) : 1;
  const punta = limites
    ? {
        min: Math.floor(limites.min / paso) * paso,
        max: Math.ceil(limites.max / paso) * paso,
      }
    : null;
  const aManija = (v: number) =>
    v <= (punta?.min ?? 0) ? "" : v >= (punta?.max ?? 0) ? "" : String(v);
  const valor = punta
    ? [
        Math.min(Math.max(aPesos(desde) ?? punta.min, punta.min), punta.max),
        Math.min(Math.max(aPesos(hasta) ?? punta.max, punta.min), punta.max),
      ]
    : null;

  return (
    <div className="flex flex-col gap-2.5">
      <h3
        id="filtro-precio"
        className="text-caption font-medium tracking-wide text-ink-secondary uppercase"
      >
        Precio
      </h3>

      {/* Sin `<legend>`: dejaría al grupo fuera del recorrido por encabezados. */}
      {punta && valor ? (
        <Slider
          min={punta.min}
          max={punta.max}
          step={paso}
          minStepsBetweenThumbs={1}
          value={valor}
          etiquetas={["Precio mínimo", "Precio máximo"]}
          // Se filtra al soltar.
          onValueChange={([a, b]) => {
            clearTimeout(espera.current);
            setDesde(aManija(a));
            setHasta(aManija(b));
          }}
          onValueCommit={([a, b]) => aplicar(aManija(a), aManija(b), true)}
        />
      ) : null}

      <form
        method="get"
        // Sin JavaScript, el envío vuelve a la misma categoría.
        action={rutaDeTienda(filtros.seccion)}
        aria-labelledby="filtro-precio"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar(desde, hasta, true);
        }}
      >
        <Conservados filtros={filtros} />
        <CampoDePrecio
          nombre="precioMin"
          etiqueta="Desde"
          ayuda={punta ? pesos.format(punta.min) : ""}
          valor={desde}
          alCambiar={(v) => {
            setDesde(v);
            alEscribir(v, hasta);
          }}
          alSalir={() => aplicar(desde, hasta, true)}
        />
        <span aria-hidden className="text-body-sm text-ink-secondary">
          –
        </span>
        <CampoDePrecio
          nombre="precioMax"
          etiqueta="Hasta"
          ayuda={punta ? `${pesos.format(punta.max)}+` : ""}
          valor={hasta}
          alCambiar={(v) => {
            setHasta(v);
            alEscribir(desde, v);
          }}
          alSalir={() => aplicar(desde, hasta, true)}
        />
        {/* Sin ningún botón, Enter no envía un formulario de dos campos. */}
        <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
          Aplicar
        </button>
      </form>
    </div>
  );
}

/** Los filtros vigentes como campos ocultos, para el envío sin JavaScript. */
function Conservados({ filtros }: { filtros: FiltrosDeTienda }) {
  return (
    <>
      {filtros.q ? <input type="hidden" name="q" value={filtros.q} /> : null}
      {filtros.categoria.map((slug) => (
        <input key={slug} type="hidden" name="categoria" value={slug} />
      ))}
      {filtros.marca.map((slug) => (
        <input key={slug} type="hidden" name="marca" value={slug} />
      ))}
      {filtros.color.map((slug) => (
        <input key={slug} type="hidden" name="color" value={slug} />
      ))}
      {filtros.oferta ? <input type="hidden" name="oferta" value="1" /> : null}
      {filtros.orden !== "relevancia" ? (
        <input type="hidden" name="orden" value={filtros.orden} />
      ) : null}
    </>
  );
}

/**
 * Un borde del precio. La etiqueta no se ve a propósito (excepción a las
 * etiquetas visibles, anotada en PROGRESO.md); el lector sí la anuncia.
 */
function CampoDePrecio({
  nombre,
  etiqueta,
  ayuda,
  valor,
  alCambiar,
  alSalir,
}: {
  nombre: string;
  etiqueta: string;
  ayuda: string;
  valor: string;
  alCambiar: (valor: string) => void;
  alSalir: () => void;
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{etiqueta}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body-sm text-ink-secondary"
      >
        $
      </span>
      <input
        type="number"
        name={nombre}
        min={0}
        step={1}
        inputMode="numeric"
        value={valor}
        placeholder={ayuda}
        onChange={(e) => alCambiar(e.target.value)}
        onBlur={alSalir}
        className={cn(
          "h-11 w-full rounded-pill border border-border bg-surface",
          // 16px en teléfono: con menos, iOS Safari amplía la página al enfocar.
          "pr-3 pl-7 text-body-sm max-md:text-body text-ink tabular-nums",
          "placeholder:text-ink-secondary",
          "focus-visible:shadow-focus focus-visible:outline-none",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
    </label>
  );
}
