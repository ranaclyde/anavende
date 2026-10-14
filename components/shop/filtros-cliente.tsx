"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  urlCambiando,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { cn } from "@/lib/utils";

/**
 * Las tres piezas del panel de filtros que necesitan JavaScript — pedido del
 * 2026-10-14. El panel sigue siendo un `<details>` nativo y de servidor
 * (`filtros-catalogo.tsx`): esto se monta adentro y lo encuentra con
 * `closest("details")`, igual que `BotonCerrarFiltros` y `BotonVerResultados`.
 * Sin JavaScript el panel abre, cierra y filtra como antes.
 */

/** Cerrar el `<details>` que contiene a `elemento`. */
function cerrarPanel(elemento: Element | null) {
  elemento?.closest("details")?.removeAttribute("open");
}

/**
 * Cierra el panel al tocar afuera y con Escape, que un `<details>` no hace
 * solo. No dibuja nada: es un marcador para encontrar su panel.
 *
 * Tocar ADENTRO no lo cierra, y es el punto: los chips son enlaces que
 * navegan sin recargar, y el panel se queda abierto para elegir otro. En el
 * teléfono la hoja ocupa toda la pantalla, así que no hay afuera.
 *
 * `pointerdown` y no `click`: con `click`, arrastrar el dedo para desplazar
 * la página y soltarlo afuera contaría como tocar afuera recién al soltar.
 */
export function CierreDelPanel() {
  const marcador = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = marcador.current?.closest("details");
    if (!panel) return;

    const alTocar = (e: PointerEvent) => {
      if (panel.open && !panel.contains(e.target as Node)) {
        panel.removeAttribute("open");
      }
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !panel.open) return;
      panel.removeAttribute("open");
      // El foco vuelve al botón que lo abrió: si se queda en un chip que ya
      // no se ve, el siguiente Tab arranca desde ningún lado.
      panel.querySelector("summary")?.focus();
    };

    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, []);

  return <span ref={marcador} hidden />;
}

/**
 * «Limpiar filtros»: navega a la lista sin filtros y cierra el panel. Antes
 * lo dejaba abierto con todo desmarcado, que se lee como «no pasó nada».
 */
export function LimpiarFiltros({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => cerrarPanel(e.currentTarget)}
      className={className}
    >
      Limpiar filtros
    </Link>
  );
}

/** Lo que espera el debounce antes de aplicar lo que se está escribiendo. */
const ESPERA = 700;

/** Pesos enteros, o `null` si el campo está vacío o no es un número. */
function aPesos(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number.parseInt(texto, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

const aTexto = (n: number | null) => (n === null ? "" : String(n));

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
export function RangoDePrecio({ filtros }: { filtros: FiltrosDeTienda }) {
  const router = useRouter();
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
    router.replace(urlCambiando(filtros, { precioMin: min, precioMax: max }), {
      scroll: false,
    });
  };

  const alEscribir = (d: string, h: string) => {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(d, h, false), ESPERA);
  };

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
      <form
        method="get"
        action="/productos"
        aria-labelledby="filtro-precio"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar(desde, hasta, true);
        }}
      >
        <Conservados filtros={filtros} />
        <CampoDePrecio
          nombre="precioMin"
          etiqueta="Desde"
          valor={desde}
          alCambiar={(v) => {
            setDesde(v);
            alEscribir(v, hasta);
          }}
          alSalir={() => aplicar(desde, hasta, true)}
        />
        <CampoDePrecio
          nombre="precioMax"
          etiqueta="Hasta"
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
 * Etiqueta VISIBLE y no un marcador de posición (§8): «Desde» y «Hasta» son la
 * única diferencia entre los dos campos, y un marcador desaparece justo cuando
 * se está escribiendo, que es cuando hace falta saber en cuál se está.
 */
function CampoDePrecio({
  nombre,
  etiqueta,
  valor,
  alCambiar,
  alSalir,
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  alSalir: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-secondary">
      {etiqueta}
      <span className="relative">
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
          onChange={(e) => alCambiar(e.target.value)}
          onBlur={alSalir}
          className={cn(
            // 44px, que es el mínimo táctil de §9.
            "h-11 w-28 rounded-pill border border-border bg-surface",
            // 16px en teléfono: con menos, iOS Safari amplía la página al
            // enfocar el campo y no vuelve. Ver `search-box.tsx`.
            "pr-3 pl-7 text-body-sm max-md:text-body text-ink tabular-nums",
            "focus-visible:shadow-focus focus-visible:outline-none",
            // Las flechitas nativas de `number` no entran en el sistema y
            // encima empujan el texto contra el borde.
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
      </span>
    </label>
  );
}
