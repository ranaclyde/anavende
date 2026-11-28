import type { MetadataRoute } from "next";

import { urlAbsoluta } from "@/lib/seo";
import { urlDeCategoria } from "@/modules/catalog/products/filtros-tienda";
import {
  categoriasDelMapa,
  productosDelMapa,
} from "@/modules/catalog/products/mapa-del-sitio";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/**
 * Solo lo que se indexa: los filtros salen `noindex` (`catalogoIndexable`) y
 * no entran. Sin `priority` ni `changeFrequency`, que Google ignora.
 */

// Sin esto `next build` lo prerrenderiza y consulta la base al compilar, donde
// no la hay (§18.2). En `next dev` no se ve.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productos, categorias] = await Promise.all([
    productosDelMapa(),
    categoriasDelMapa(),
  ]);

  // Viene ordenada por `updated_at DESC`: el primero es el último cambio.
  const ultimoCambio = productos[0]?.actualizado;

  return [
    { url: urlAbsoluta("/"), lastModified: ultimoCambio },
    { url: urlAbsoluta("/productos"), lastModified: ultimoCambio },
    { url: urlAbsoluta("/categorias"), lastModified: ultimoCambio },
    ...categorias.map((c) => ({
      url: urlAbsoluta(urlDeCategoria(c.slug)),
      lastModified: c.actualizado,
    })),
    ...productos.map((p) => ({
      url: urlAbsoluta(`/productos/${p.slug}`),
      lastModified: p.actualizado,
    })),
    // Sin fecha: sería una consulta más para un dato que nadie usa.
    ...PAGINAS_LEGALES.map((p) => ({
      url: urlAbsoluta(`/legales/${p.slug}`),
    })),
    { url: urlAbsoluta("/contacto") },
    { url: urlAbsoluta("/nosotros") },
  ];
}
