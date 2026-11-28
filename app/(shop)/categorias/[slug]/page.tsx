import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DatosEstructurados } from "@/components/seo/datos-estructurados";
import {
  leerElCatalogo,
  VistaDelCatalogo,
} from "@/components/shop/vista-del-catalogo";
import { categoryBreadcrumbsJsonLd } from "@/lib/structured-data";
import { OPEN_GRAPH_BASE, metaDescription, DELIVERY_AREA } from "@/lib/seo";
import { TOUCH_AREA, cn } from "@/lib/utils";
import { leerCategoriaConPagina } from "@/modules/catalog/products/categorias-de-la-tienda";
import {
  catalogoIndexable,
  leerFiltrosDeTienda,
  urlDeTienda,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros-tienda";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ParametrosDeBusqueda>;
};

/**
 * El título nombra la zona porque es lo que se busca («auriculares en
 * Viedma»); el `template` del sitio le suma «· AnaVende». La categoría no
 * cuenta como filtro: se indexa sin filtros, como el catálogo.
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
    ? metaDescription(categoria.texto)
    : `${categoria.nombre} en AnaVende. ${DELIVERY_AREA}`;

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
 * El catálogo con la categoría fija (`filtros.seccion`). Existe para los
 * buscadores: en `/productos` la categoría es un filtro, y lo filtrado es
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
      {/* Las mismas migas de arriba del título, para los buscadores. */}
      <DatosEstructurados datos={[categoryBreadcrumbsJsonLd(categoria)]} />

      <header className="flex flex-col gap-2 pb-7">
        <Migas nombre={categoria.nombre} />
        <h1 className="text-title text-ink">{categoria.nombre}</h1>
        {/* El texto de la vendedora puede llegar a tres renglones. */}
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

function Migas({ nombre }: { nombre: string }) {
  return (
    <nav aria-label="Miga de pan">
      <ol className="flex flex-wrap items-center gap-1 text-body-sm text-ink-secondary">
        <li>
          {/* La zona sensible se estira a 44px sin tocar el dibujo (§9). */}
          <Link
            href="/categorias"
            className={cn("relative rounded-pill hover:text-ink", TOUCH_AREA)}
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
