import type { Metadata } from "next";

import {
  leerElCatalogo,
  VistaDelCatalogo,
} from "@/components/shop/vista-del-catalogo";
import {
  catalogoIndexable,
  leerFiltrosDeTienda,
  urlDeTienda,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros-tienda";
import { OPEN_GRAPH_BASE, ZONA_DE_ENTREGA } from "@/lib/seo";

const TITULO = "Productos";
const DESCRIPCION = `Teclados, mouses, auriculares y cables. ${ZONA_DE_ENTREGA}`;

/**
 * El `canonical` es la dirección normalizada, no la que llegó: si no, cada
 * forma de escribir el mismo filtro sería otra página. Lo filtrado va con
 * `noindex, follow` (el motivo está en `catalogoIndexable`).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ParametrosDeBusqueda>;
}): Promise<Metadata> {
  const filtros = leerFiltrosDeTienda(await searchParams);
  const ruta = urlDeTienda(filtros);

  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical: ruta },
    ...(catalogoIndexable(filtros)
      ? {}
      : { robots: { index: false, follow: true } }),
    openGraph: {
      ...OPEN_GRAPH_BASE,
      url: ruta,
      title: TITULO,
      description: DESCRIPCION,
    },
  };
}

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltrosDeTienda(await searchParams);
  const datos = await leerElCatalogo(filtros);

  // Con dos o más categorías el título vuelve a ser genérico: nombrarlas
  // prometería un recorte que no es el que hay (los chips lo muestran entero).
  const unicaCategoria =
    filtros.categoria.length === 1
      ? datos.opciones.categorias.find((c) => c.slug === filtros.categoria[0])
      : undefined;
  const titulo = filtros.q
    ? `Resultados para «${filtros.q}»`
    : (unicaCategoria?.nombre ?? "Todos los productos");

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-7">
        <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
          Productos
        </p>
        <h1 className="text-title text-ink">{titulo}</h1>
        <p className="text-body text-ink-secondary">
          Periféricos y accesorios. Entrega en Viedma, Carmen de Patagones y
          alrededores.
        </p>
      </header>

      <VistaDelCatalogo
        filtros={filtros}
        datos={datos}
        placeholder="Buscá por producto, marca o categoría"
        vacio={{
          titulo: "Todavía no hay productos",
          detalle: "Estamos cargando el catálogo. Volvé en un rato.",
        }}
      />
    </div>
  );
}
