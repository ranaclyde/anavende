import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DatosEstructurados } from "@/components/seo/datos-estructurados";
import {
  leerElCatalogo,
  VistaDelCatalogo,
} from "@/components/shop/vista-del-catalogo";
import { migasDeCategoria } from "@/lib/datos-estructurados";
import {
  OPEN_GRAPH_BASE,
  resumenDeMetadatos,
  ZONA_DE_ENTREGA,
} from "@/lib/seo";
import { AREA_TACTIL, cn } from "@/lib/utils";
import { leerCategoriaConPagina } from "@/modules/catalog/products/categorias-de-la-tienda";
import {
  catalogoIndexable,
  leerFiltrosDeTienda,
  urlDeTienda,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros-tienda";

type Props = {
  // En Next 16 `params` y `searchParams` son promesas.
  params: Promise<{ slug: string }>;
  searchParams: Promise<ParametrosDeBusqueda>;
};

/**
 * Metadatos de la página de una categoría — F3.11, RNF-04.
 *
 * **El título nombra la zona**, «Auriculares en Viedma y Patagones», porque
 * es lo que se busca: nadie escribe «auriculares AnaVende». El `template` del
 * sitio le suma «· AnaVende».
 *
 * **La descripción es el texto de la vendedora** si lo escribió, recortado
 * a lo que Google muestra; si no, una frase con la categoría y la zona.
 *
 * **Se indexa sin filtros y nada más**, con la misma regla del catálogo
 * (`catalogoIndexable`): la categoría no es un filtro, así que
 * `/categorias/auriculares` se indexa y `/categorias/auriculares?marca=hyperx`
 * no. El `canonical` es la dirección normalizada.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const categoria = await leerCategoriaConPagina(slug);
  if (!categoria) return {};

  const filtros = leerFiltrosDeTienda(await searchParams, categoria.slug);
  const ruta = urlDeTienda(filtros);
  const titulo = `${categoria.nombre} en Viedma y Patagones`;
  const descripcion = categoria.texto
    ? resumenDeMetadatos(categoria.texto)
    : `${categoria.nombre} en AnaVende. ${ZONA_DE_ENTREGA}`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    ...(catalogoIndexable(filtros)
      ? {}
      : { robots: { index: false, follow: true } }),
    openGraph: {
      ...OPEN_GRAPH_BASE,
      url: ruta,
      title: titulo,
      description: descripcion,
    },
  };
}

/**
 * La página de una categoría — F3.11, RF-02, RNF-04.
 *
 * **Es el catálogo con la categoría fija** (`filtros.seccion`): la misma
 * barra, los mismos filtros, la misma grilla (`VistaDelCatalogo`). Cambian
 * cuatro cosas, las del boceto aprobado el 2026-11-03:
 *
 *   · **Migas «Categorías › Auriculares»** en lugar de la etiqueta
 *     «CATÁLOGO».
 *   · **El texto de la vendedora** debajo del título; sin texto, la frase de
 *     siempre.
 *   · **Sin chip de la categoría**: es la página, no un filtro. «Filtros»
 *     arranca en cero y «Limpiar todo» deja en la misma categoría.
 *   · **En el menú se marca «Categorías»** (`navegacion-principal.tsx`).
 *
 * Existe para los buscadores: con la categoría como filtro de `/productos`,
 * «teclados en Viedma» no tenía a dónde llegar, porque todo lo filtrado es
 * `noindex`.
 */
export default async function PaginaDeCategoria({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const categoria = await leerCategoriaConPagina(slug);
  if (!categoria) notFound();

  const filtros = leerFiltrosDeTienda(await searchParams, categoria.slug);
  const datos = await leerElCatalogo(filtros);

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      {/*
        F3.9 — el rastro de migas, para quien lee el HTML sin ojos. Es el
        mismo camino que se ve arriba del título.
      */}
      <DatosEstructurados datos={[migasDeCategoria(categoria)]} />

      <header className="flex flex-col gap-2 pb-7">
        <Migas nombre={categoria.nombre} />
        <h1 className="text-title text-ink">{categoria.nombre}</h1>
        {/*
          `max-w-prose`: el texto de la vendedora puede llegar a tres
          renglones, y a lo ancho de la tienda cada renglón se haría
          ilegible. La frase de siempre es una sola línea y no lo necesita,
          pero tampoco le molesta.
        */}
        <p className="max-w-prose text-body text-ink-secondary">
          {categoria.texto ??
            "Periféricos y accesorios. Entrega en Viedma, Carmen de Patagones y alrededores."}
        </p>
      </header>

      <VistaDelCatalogo
        filtros={filtros}
        datos={datos}
        placeholder={`Buscá en ${categoria.nombre.toLowerCase()}`}
        vacio={{
          titulo: `Todavía no hay productos en ${categoria.nombre}`,
          detalle: "Mirá lo que hay en las otras categorías.",
          accion: { texto: "Ver las categorías", href: "/categorias" },
        }}
      />
    </div>
  );
}

/**
 * «Categorías › Auriculares». El último escalón es la página en la que se
 * está: no es un enlace, y lo dice con `aria-current`.
 */
function Migas({ nombre }: { nombre: string }) {
  return (
    <nav aria-label="Miga de pan">
      <ol className="flex flex-wrap items-center gap-1 text-body-sm text-ink-secondary">
        <li>
          {/*
            El texto de la miga mide 17px de alto: se le estira la zona
            sensible a 44 sin tocar el dibujo (§9), como en la ficha.
          */}
          <Link
            href="/categorias"
            className={cn("relative rounded-pill hover:text-ink", AREA_TACTIL)}
          >
            Categorías
          </Link>
        </li>
        <li aria-hidden className="text-ink-tertiary">
          <ChevronRight className="size-4" />
        </li>
        <li aria-current="page" className="text-ink">
          {nombre}
        </li>
      </ol>
    </nav>
  );
}
