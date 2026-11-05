import Link from "next/link";
import { Check, X } from "lucide-react";

import { DrawerDeFiltros } from "@/components/shop/drawer-de-filtros";
import { EsperaDelFiltro } from "@/components/shop/filtrando";
import {
  GrupoDeFiltro,
  type OpcionDelGrupo,
} from "@/components/shop/grupo-de-filtro";
import {
  RangoDePrecio,
  type LimitesDePrecio,
} from "@/components/shop/filtros-cliente";

import {
  alternar,
  comoFiltroDeCategoria,
  contarFiltrosDeTienda,
  hayFiltrosDeTienda,
  urlCambiando,
  urlSinFiltros,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { formatMoney } from "@/lib/money";
import { TIPO_FILTRO } from "@/lib/transiciones";
import type {
  OpcionDeColor,
  OpcionDeFiltro,
} from "@/modules/catalog/products/tienda";
import { AREA_TACTIL, cn } from "@/lib/utils";

/**
 * Filtros del catálogo — F3.8, RF-02, §7.2.
 *
 * **Todo son enlaces, no controles.** Un filtro que es un `<a>` se puede abrir
 * en otra pestaña, se precarga al pasar por encima, funciona sin JavaScript y
 * —lo que más importa— deja el botón atrás haciendo exactamente lo que la
 * persona espera. Con casillas y estado de cliente habría que reimplementar
 * las cuatro cosas, y la cuarta nunca queda bien.
 *
 * **El panel es el `Sheet` de los drawers del panel** (`drawer-de-filtros.tsx`,
 * 2026-11-04): un drawer a la derecha, y en el teléfono a pantalla completa.
 * Hasta entonces era un `<details>` nativo, que abría sin JavaScript pero no
 * se animaba y obligaba a reimplementar el foco, Escape y el fondo. Lo de
 * adentro sigue armándose acá, en el servidor; las islas son el precio
 * (`filtros-cliente.tsx`) y cada grupo (`grupo-de-filtro.tsx`), que recorta
 * las listas largas y les pone un buscador.
 */

type Props = {
  filtros: FiltrosDeTienda;
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
  colores: OpcionDeColor[];
  precios?: LimitesDePrecio | null;
  /** Productos en oferta con los demás filtros (`leerOpcionesDeFiltro`). */
  enOferta?: number;
};

export function PanelDeFiltros({
  filtros,
  categorias,
  marcas,
  colores,
  precios = null,
  enOferta = 0,
  total,
}: Props & { total: number }) {
  const categoriasElegidas = comoFiltroDeCategoria(filtros);

  return (
    <DrawerDeFiltros
      puestos={contarFiltrosDeTienda(filtros)}
      total={total}
      hrefLimpiar={hayFiltrosDeTienda(filtros) ? urlSinFiltros(filtros) : null}
    >
      {/*
        **Una sola columna, con una línea entre sección y sección**
        (2026-11-04). Con 512px no entran dos. Las ofertas van primero: es el
        filtro que más se busca y el único de sí o no. El precio va al final,
        con su slider.
      */}
      {/*
        Sin nada en oferta con los demás filtros, la casilla llevaría a un
        vacío y no se ofrece (2026-11-05), como una marca sin productos. Si ya
        está puesta, se ve igual, para poder sacarla.
      */}
      {filtros.oferta || enOferta > 0 ? (
        <section
          className="flex flex-col gap-2.5"
          aria-labelledby="filtro-ofertas"
        >
          <h3
            id="filtro-ofertas"
            className="text-caption font-medium tracking-wide text-ink-secondary uppercase"
          >
            Ofertas
          </h3>
          <Casilla
            href={urlCambiando(filtros, { oferta: !filtros.oferta })}
            activa={filtros.oferta}
            etiqueta="Solo productos en oferta"
          />
        </section>
      ) : null}
      {/*
        En la página de una categoría (F3.11) la categoría de la página es un
        chip marcado más: elegir otra la suma y lleva a `/productos` con las
        dos, y destildarla lleva a `/productos` con el resto de los filtros
        (`comoFiltroDeCategoria`).
      */}
      <GrupoDeFiltro
        titulo="Categoría"
        plural="categorías"
        opciones={resolver(categorias, categoriasElegidas.categoria, (slug) =>
          urlCambiando(categoriasElegidas, {
            categoria: alternar(categoriasElegidas.categoria, slug),
          }),
        )}
      />
      <GrupoDeFiltro
        titulo="Marca"
        plural="marcas"
        opciones={resolver(marcas, filtros.marca, (slug) =>
          urlCambiando(filtros, { marca: alternar(filtros.marca, slug) }),
        )}
      />
      <GrupoDeFiltro
        titulo="Color"
        plural="colores"
        opciones={resolver(colores, filtros.color, (slug) =>
          urlCambiando(filtros, { color: alternar(filtros.color, slug) }),
        )}
      />
      <RangoDePrecio filtros={filtros} limites={precios} />
    </DrawerDeFiltros>
  );
}

/**
 * Las opciones de un grupo con su enlace y su estado ya armados, para que la
 * isla del grupo (`grupo-de-filtro.tsx`) reciba datos y no funciones: lo que
 * cruza al cliente tiene que poder serializarse.
 */
function resolver(
  opciones: (OpcionDeFiltro | OpcionDeColor)[],
  seleccionados: readonly string[],
  urlDe: (slug: string) => string,
): OpcionDelGrupo[] {
  return opciones.map((o) => ({
    slug: o.slug,
    nombre: o.nombre,
    hex: "hex" in o ? o.hex : null,
    href: urlDe(o.slug),
    activo: seleccionados.includes(o.slug),
  }));
}

/**
 * El descuento se ve como casilla porque no es una opción entre varias: es
 * sí o no. Un chip suelto en una fila de uno parecería un grupo al que le
 * faltan los demás.
 *
 * Sigue siendo un enlace por el mismo motivo que todo lo demás de este
 * archivo. La casilla es dibujada, no un `<input>`: un input real necesitaría
 * JavaScript para navegar, y perdería el atrás.
 */
function Casilla({
  href,
  activa,
  etiqueta,
}: {
  href: string;
  activa: boolean;
  etiqueta: string;
}) {
  return (
    <Link
      href={href}
      transitionTypes={TIPO_FILTRO}
      aria-current={activa ? "true" : undefined}
      className={cn(
        "relative flex w-fit items-center gap-2.5 rounded-pill py-1.5 pr-3 pl-1.5",
        "text-body-sm transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        AREA_TACTIL,
        activa ? "font-medium text-brand" : "text-ink-secondary hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150",
          activa
            ? "border-brand bg-brand text-ink-inverse"
            : "border-border-strong bg-surface",
        )}
        aria-hidden="true"
      >
        {activa ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {etiqueta}
      <span className="sr-only">
        {activa ? " — quitar este filtro" : " — aplicar este filtro"}
      </span>
      <EsperaDelFiltro />
    </Link>
  );
}

/**
 * Los filtros aplicados, como chips removibles arriba de la grilla (§7.2).
 *
 * Existe porque los filtros viven detrás de un botón: sin los chips, la
 * persona ve nueve resultados y **no tiene forma de saber por qué** son
 * nueve. El chip dice qué está puesto y lo saca de un toque.
 */
export function ChipsDeFiltros({
  filtros,
  categorias,
  marcas,
  colores,
}: Props) {
  if (!hayFiltrosDeTienda(filtros)) return null;

  const puestos: { clave: string; etiqueta: string; href: string }[] = [];

  if (filtros.q) {
    puestos.push({
      clave: "q",
      etiqueta: `«${filtros.q}»`,
      href: urlCambiando(filtros, { q: "" }),
    });
  }

  /*
   * Un chip por VALOR, no por grupo: con dos marcas puestas hay dos chips y
   * cada uno saca la suya. Un chip «2 marcas» diría cuántas hay y obligaría a
   * abrir el panel para saber cuáles, que es justo lo que los chips existen
   * para evitar.
   *
   * Si un slug no está en las opciones no se dibuja chip, y eso pasa
   * de verdad: una categoría cuyo último producto se desactivó desaparece de
   * la lista. La salida no se pierde —«Limpiar todo» está siempre al final de
   * esta misma fila—, pero el filtro invisible es el motivo por el que ese
   * enlace no es opcional.
   */
  const grupos = [
    { clave: "categoria", slugs: filtros.categoria, opciones: categorias },
    { clave: "marca", slugs: filtros.marca, opciones: marcas },
    { clave: "color", slugs: filtros.color, opciones: colores },
  ] as const;

  for (const grupo of grupos) {
    for (const slug of grupo.slugs) {
      const opcion = grupo.opciones.find((o) => o.slug === slug);
      if (!opcion) continue;
      puestos.push({
        clave: `${grupo.clave}-${slug}`,
        etiqueta: opcion.nombre,
        href: urlCambiando(filtros, {
          [grupo.clave]: alternar(grupo.slugs, slug),
        }),
      });
    }
  }

  if (filtros.precioMin !== null || filtros.precioMax !== null) {
    puestos.push({
      clave: "precio",
      etiqueta: etiquetaDePrecio(filtros),
      // Los dos bordes se van juntos: es UN filtro, y su chip es uno.
      href: urlCambiando(filtros, { precioMin: null, precioMax: null }),
    });
  }

  if (filtros.oferta) {
    puestos.push({
      clave: "oferta",
      etiqueta: "En oferta",
      href: urlCambiando(filtros, { oferta: false }),
    });
  }

  return (
    // `flex-wrap`: con cinco filtros puestos en un teléfono, una fila sola
    // recortaría los últimos y esos valores dejarían de poder quitarse.
    // `gap-y-4` y no `gap-2`: estos chips miden 30px de alto, así que su área
    // táctil sobresale 7px por lado. Con 8px de separación entre filas, dos
    // filas se pisarían el blanco y se tocaría el chip de arriba queriendo
    // tocar el de abajo.
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-4">
      {puestos.map((p) => (
        <li key={p.clave}>
          <Link
            href={p.href}
            transitionTypes={TIPO_FILTRO}
            // Tinte de marca y no blanco: sobre el canvas gris, un chip
            // blanco es una superficie más entre otras y no se lee como «esto
            // está aplicado». El tinte lo dice sin sumar un color al sistema.
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border border-brand-tint-border bg-brand-tint",
              "py-1.5 pr-2 pl-3 text-caption font-medium whitespace-nowrap text-brand",
              "transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-ink-inverse",
              "focus-visible:shadow-focus focus-visible:outline-none",
              AREA_TACTIL,
            )}
          >
            {p.etiqueta}
            <X className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Quitar este filtro</span>
            <EsperaDelFiltro />
          </Link>
        </li>
      ))}

      <li>
        <Link
          href={urlSinFiltros(filtros)}
          transitionTypes={TIPO_FILTRO}
          className={cn(
            "relative rounded-full px-2 py-1.5 text-caption font-medium text-ink-secondary underline underline-offset-2",
            "transition-colors duration-150 hover:text-brand",
            "focus-visible:shadow-focus focus-visible:outline-none",
            AREA_TACTIL,
          )}
        >
          Limpiar todo
          <EsperaDelFiltro />
        </Link>
      </li>
    </ul>
  );
}

/**
 * «$ 5.000,00 – $ 20.000,00», «Desde $ 5.000,00» o «Hasta $ 20.000,00».
 *
 * Con `formatMoney` y no con el número pelado: RN-02 pide que todo precio de
 * la tienda se vea igual, y un chip que dice «5000» al lado de tarjetas que
 * dicen «$ 5.000,00» se lee como si fuera otra cosa.
 */
function etiquetaDePrecio(f: FiltrosDeTienda): string {
  const min = f.precioMin !== null ? formatMoney(String(f.precioMin)) : null;
  const max = f.precioMax !== null ? formatMoney(String(f.precioMax)) : null;

  if (min !== null && max !== null) return `${min} – ${max}`;
  if (min !== null) return `Desde ${min}`;
  return `Hasta ${max}`;
}
