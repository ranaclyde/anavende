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

const TITULO = "Catálogo";
const DESCRIPCION = `Teclados, mouses, auriculares y cables. ${ZONA_DE_ENTREGA}`;

/**
 * Metadatos del catálogo — F3.9, RNF-04.
 *
 * **Dependen de los filtros**, y por eso son una función y no un objeto: la
 * misma pantalla es la portada del catálogo o el resultado de una búsqueda
 * según lo que traiga la dirección, y las dos cosas no se anuncian igual.
 *
 * Dos instrucciones, y las dos salen de `catalogoIndexable`:
 *
 *   · **El `canonical` es la dirección NORMALIZADA**, no la que llegó.
 *     `urlDeTienda` reescribe los filtros en su orden, sin repetidos y sin lo
 *     que vale lo de siempre, así que `?marca=a&marca=a&orden=relevancia` y
 *     `?marca=a` declaran la misma página. Sin eso, cada forma de escribir el
 *     mismo filtro es una página distinta.
 *   · **`noindex, follow` en todo lo filtrado.** El motivo entero está en
 *     `catalogoIndexable`; acá solo se aplica.
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

/**
 * Catálogo — F3.8, RF-02, §7.2, §10.2.
 *
 * Todo el estado vive en la URL: filtros, orden y página. Eso es lo que hace
 * que el botón atrás funcione, que el enlace se pueda mandar por WhatsApp tal
 * como se está viendo, y que esta pantalla no necesite ni una línea de estado
 * de cliente para lo que muestra.
 *
 * La columna de filtros de 260px que pedía §7.2 se reemplazó por la barra con
 * panel desplegable del canvas aprobado en F3.8. §7.2 quedó actualizada.
 */
export default async function Catalogo({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltrosDeTienda(await searchParams);
  const datos = await leerElCatalogo(filtros);

  /*
   * El título dice qué se está mirando, no siempre «Catálogo».
   *
   * Con una búsqueda puesta, un encabezado genérico obliga a mirar los chips
   * para saber por qué hay nueve resultados. El `<h1>` es lo primero que
   * anuncia un lector de pantalla al llegar: que diga el término buscado es la
   * diferencia entre orientarse y tener que explorar la página.
   */
  // Con UNA categoría elegida el título la nombra; con dos vuelve a ser
  // genérico. «Teclados y Mouses» arriba de una grilla que además está
  // filtrada por marca y por precio promete un recorte que no es el que hay:
  // para eso están los chips, que los muestran todos.
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
          Catálogo
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
