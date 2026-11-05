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
import { TIPO_FILTRO } from "@/lib/transiciones";
import { cn } from "@/lib/utils";

/**
 * El precio, la pieza del panel de filtros que necesita estado. El resto del
 * panel se arma en el servidor (`filtros-catalogo.tsx`) y se abre en el
 * drawer de `drawer-de-filtros.tsx`, que trae el cierre con Escape, tocando
 * afuera y con «Limpiar filtros».
 */

/** Lo que espera el debounce antes de aplicar lo que se está escribiendo. */
const ESPERA = 700;

/** Pesos enteros, o `null` si el campo está vacío o no es un número. */
function aPesos(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number.parseInt(texto, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const aTexto = (n: number | null) => (n === null ? "" : String(n));

/** Los precios finales más bajo y más alto del catálogo, en pesos enteros. */
export type LimitesDePrecio = { min: number; max: number };

/**
 * El paso del slider: unos cien pasos entre punta y punta, redondo. Con un
 * catálogo de $ 3.000 a $ 160.000 son $ 1.000; de a $ 1 la manija no se
 * puede dejar en un número que se lea.
 */
function pasoPara({ min, max }: LimitesDePrecio): number {
  const rango = max - min;
  if (rango <= 100) return 1;
  return 10 ** (Math.floor(Math.log10(rango)) - 2);
}

const pesos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/**
 * El rango de precio (RF-02), **sin «Aplicar»** desde el 2026-10-14.
 *
 * Se aplica solo: 700ms después de dejar de escribir, o enseguida con Enter
 * o al salir del campo. Navega sin recargar, como los chips —el botón hacía
 * un envío de formulario, que recargaba la página entera—, y con `replace`:
 * escribir un precio no puede dejar una entrada del historial por pausa.
 *
 * **Con «Desde» mayor que «Hasta» el debounce espera.** `leerFiltrosDeTienda`
 * los da vuelta, y aplicarlo a mitad de escribir —«Hasta 2» camino a 20.000—
 * cambiaría los dos campos debajo de los dedos. Al salir del campo o con
 * Enter sí se aplica, y ahí darlos vuelta es lo que se quiere.
 *
 * Sigue siendo un formulario GET con los demás filtros como campos ocultos:
 * sin JavaScript, Enter lo envía como antes. Para eso queda un botón de envío
 * oculto, porque sin ninguno un formulario de dos campos no se envía con
 * Enter.
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
  // La transición es para enterarse de cuándo termina: mientras tanto, la
  // grilla se atenúa (`filtrando.tsx`).
  const [pendiente, iniciar] = useTransition();
  useAvisarFiltrando(pendiente);
  const [desde, setDesde] = useState(aTexto(filtros.precioMin));
  const [hasta, setHasta] = useState(aTexto(filtros.precioMax));
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Si el precio cambia desde afuera —«Limpiar filtros», el chip del precio,
  // el atrás—, los campos lo siguen. Se ajusta al renderizar y no con un
  // efecto (así lo recomienda React): con un efecto se pintaría una vez el
  // valor viejo. Cuando el cambio es el que mandaron estos mismos campos, el
  // texto ya dice eso y no se toca, así no se pisa lo que se está tipeando.
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
      // Dados vuelta acá y no solo al leerlos: si no, la dirección quedaría
      // con «desde 50.000 hasta 2» y los campos diciendo lo contrario.
      [min, max] = [max, min];
    }
    if (min === filtros.precioMin && max === filtros.precioMax) return;
    iniciar(() => {
      router.replace(
        urlCambiando(filtros, { precioMin: min, precioMax: max }),
        { scroll: false, transitionTypes: TIPO_FILTRO },
      );
    });
  };

  const alEscribir = (d: string, h: string) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(d, h, false), ESPERA);
  };

  /*
   * El slider y los campos dicen lo mismo. Las puntas del slider son los
   * precios del catálogo redondeados al paso, y **una manija en su punta es
   * «sin límite»**: el campo queda vacío y la dirección no lleva ese borde.
   * Si no, mover solo la de abajo dejaría puesto un «hasta $ 160.000» que
   * nadie eligió, y un producto nuevo más caro quedaría afuera.
   */
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

      {/*
        `aria-labelledby` y no un `<fieldset>` con `<legend>`: el legend
        dejaría a este grupo fuera del recorrido por encabezados mientras los
        otros tres son `h3`.
      */}
      {punta && valor ? (
        <Slider
          min={punta.min}
          max={punta.max}
          step={paso}
          minStepsBetweenThumbs={1}
          value={valor}
          etiquetas={["Precio mínimo", "Precio máximo"]}
          // Mientras se arrastra solo cambian los campos; se filtra al
          // soltar, como con Enter en los campos.
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
        // La página de la categoría, si se está en una (F3.11): sin
        // JavaScript, el envío tiene que volver al mismo lugar.
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
        {/* Solo para que Enter envíe sin JavaScript; con JavaScript lo
          intercepta `onSubmit`. Fuera del recorrido con Tab y del lector. */}
        <button type="submit" tabIndex={-1} aria-hidden className="sr-only">
          Aplicar
        </button>
      </form>
    </div>
  );
}

/**
 * Los filtros vigentes como campos ocultos, para que el envío sin JavaScript
 * no se los lleve puestos. Los multivalor van repetidos, que es exactamente
 * la forma que `leerFiltrosDeTienda` sabe leer.
 */
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
 * Un borde del precio, a todo el ancho de su columna (2026-11-04, pedido tuyo
 * con una referencia). **La etiqueta ya no se ve**: el «–» entre los dos
 * campos y el slider de arriba dicen cuál es cuál, y el marcador muestra la
 * punta del catálogo («3.000», «160.000+»). Para el lector de pantalla sigue
 * siendo «Desde» y «Hasta». Es una excepción a la regla de §8 de etiquetas
 * visibles, anotada en PROGRESO.md.
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
          // 44px, que es el mínimo táctil de §9.
          "h-11 w-full rounded-pill border border-border bg-surface",
          // 16px en teléfono: con menos, iOS Safari amplía la página al
          // enfocar el campo y no vuelve. Ver `search-box.tsx`.
          "pr-3 pl-7 text-body-sm max-md:text-body text-ink tabular-nums",
          "placeholder:text-ink-secondary",
          "focus-visible:shadow-focus focus-visible:outline-none",
          // Las flechitas nativas de `number` no entran en el sistema y
          // encima empujan el texto contra el borde.
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
    </label>
  );
}
