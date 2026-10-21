import type { Metadata } from "next";

import { ListadoDeCategorias } from "@/components/shop/listado-de-categorias";
import { OPEN_GRAPH_BASE } from "@/lib/seo";
import { leerCategoriasDeLaTienda } from "@/modules/catalog/products/categorias-de-la-tienda";
import { CATEGORIAS_EN_LA_HOME } from "@/modules/catalog/products/home";
import { numeroDeWhatsApp } from "@/modules/settings/queries";

const DESCRIPCION =
  "Todas las categorías de AnaVende, de la A a la Z: teclados, mouses, auriculares, cables y más. Si no encontrás lo que buscás, escribinos.";

export const metadata: Metadata = {
  title: "Categorías",
  description: DESCRIPCION,
  // El `?q=` del buscador no hace otra página: el canónico es siempre la
  // lista entera.
  alternates: { canonical: "/categorias" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/categorias",
    title: "Categorías",
    description: DESCRIPCION,
  },
};

/**
 * Categorías — RF-35, DR §7.6. Tarea F3.10.
 *
 * Se llega desde «Ver todas» de la home y desde «Tienda» en el pie. Arriba
 * las destacadas, después todas de la A a la Z con su cantidad, las que no
 * tienen productos al final y un cierre para escribirle a la vendedora.
 *
 * **La página trae todas y el buscador filtra en el navegador** (ver
 * `ListadoDeCategorias`). Lo que hace el servidor es leerlas, junto con el
 * número de WhatsApp, y pasarle el `?q=` con que se llegó para que la primera
 * pintura ya sea el resultado.
 */
export default async function Categorias({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  // Independientes: una no espera a la otra.
  const [categorias, whatsapp, { q }] = await Promise.all([
    leerCategoriasDeLaTienda(),
    numeroDeWhatsApp(),
    searchParams,
  ]);

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-7">
        <h1 className="text-title text-ink">Categorías</h1>
        <p className="text-body text-ink-secondary">
          Todo lo que vendemos, de la A a la Z.
        </p>
      </header>

      <ListadoDeCategorias
        categorias={categorias}
        topeDeDestacadas={CATEGORIAS_EN_LA_HOME}
        whatsapp={whatsapp}
        busquedaInicial={typeof q === "string" ? q : ""}
      />
    </div>
  );
}
