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
import { FILTER_TYPE } from "@/lib/transitions";
import type {
  OpcionDeColor,
  OpcionDeFiltro,
} from "@/modules/catalog/products/tienda";
import { TOUCH_AREA, cn } from "@/lib/utils";

/**
 * Filtros del catálogo (RF-02). **Todo son enlaces, no controles**: se abren
 * en otra pestaña, se precargan, funcionan sin JavaScript y dejan el botón
 * atrás haciendo lo que la persona espera.
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
      {/* Una sola columna: con 512px no entran dos. */}
      {/*
        Sin nada en oferta, la casilla llevaría a un vacío. Si ya está puesta,
        se ve igual, para poder sacarla.
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
        En la página de una categoría, esa categoría es un chip marcado más:
        elegir otra o destildarla lleva a `/productos`.
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

/** Arma enlaces y estado acá: a la isla del grupo solo cruzan datos serializables. */
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
 * Casilla dibujada y no un `<input>`: un input real necesitaría JavaScript
 * para navegar, y perdería el atrás.
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
      transitionTypes={FILTER_TYPE}
      aria-current={activa ? "true" : undefined}
      className={cn(
        "relative flex w-fit items-center gap-2.5 rounded-pill py-1.5 pr-3 pl-1.5",
        "text-body-sm transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        TOUCH_AREA,
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

/** Los filtros aplicados, como chips removibles arriba de la grilla. */
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

  // Un slug que no está en las opciones no lleva chip, y pasa: una categoría
  // sin productos activos desaparece. Por eso «Limpiar todo» no es opcional.
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
    // `gap-y-4`: el área táctil sobresale 7px por lado del chip, y con menos
    // separación dos filas se pisarían.
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-4">
      {puestos.map((p) => (
        <li key={p.clave}>
          <Link
            href={p.href}
            transitionTypes={FILTER_TYPE}
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border border-brand-tint-border bg-brand-tint",
              "py-1.5 pr-2 pl-3 text-caption font-medium whitespace-nowrap text-brand",
              "transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-ink-inverse",
              "focus-visible:shadow-focus focus-visible:outline-none",
              TOUCH_AREA,
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
          transitionTypes={FILTER_TYPE}
          className={cn(
            "relative rounded-full px-2 py-1.5 text-caption font-medium text-ink-secondary underline underline-offset-2",
            "transition-colors duration-150 hover:text-brand",
            "focus-visible:shadow-focus focus-visible:outline-none",
            TOUCH_AREA,
          )}
        >
          Limpiar todo
          <EsperaDelFiltro />
        </Link>
      </li>
    </ul>
  );
}

/** «$ 5.000,00 – $ 20.000,00», «Desde $ 5.000,00» o «Hasta $ 20.000,00». */
function etiquetaDePrecio(f: FiltrosDeTienda): string {
  const min = f.precioMin !== null ? formatMoney(String(f.precioMin)) : null;
  const max = f.precioMax !== null ? formatMoney(String(f.precioMax)) : null;

  if (min !== null && max !== null) return `${min} – ${max}`;
  if (min !== null) return `Desde ${min}`;
  return `Hasta ${max}`;
}
