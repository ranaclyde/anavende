import type { MetadataRoute } from "next";

import { urlAbsoluta } from "@/lib/seo";
import { productosDelMapa } from "@/modules/catalog/products/mapa-del-sitio";

/**
 * `sitemap.xml` — F3.9, RNF-04.
 *
 * **Solo las direcciones que se indexan**: la home, el catálogo sin filtrar y
 * cada ficha activa. Los filtros no entran —son `?categoria=<uuid>` y salen
 * marcados `noindex` (ver `productos/page.tsx`)—, y las páginas de sesión
 * tampoco. Un mapa del sitio no es el índice de todo lo que responde 200: es
 * la lista de lo que pedimos que se indexe, y meter ahí algo que la misma
 * página marca como no indexable es mandar dos instrucciones opuestas.
 *
 * **`lastModified` y nada más.** `priority` y `changeFrequency` son parte del
 * protocolo y Google dice desde 2015 que los ignora; escribirlos sería
 * inventar números que nadie lee. `lastModified` sí se usa, y acá es real:
 * sale de `products.updated_at`, que el panel escribe en cada edición.
 */

/**
 * Como `/mantenimiento` y `/api/salud`, y por el mismo motivo (F2.7b): esto
 * consulta la base, y **`next build` corre sin `DATABASE_URL`** (§18.2). Sin
 * esta línea Next lo prerrenderiza al compilar, la consulta corre donde no hay
 * base, y la construcción se cae en Coolify sin haberse caído en `next dev`.
 * Ya pasó una vez, con esta misma trampa.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const productos = await productosDelMapa();

  // Lo más nuevo del catálogo fecha también a la home y al catálogo: las dos
  // cambian cuando cambia un producto. La consulta ya viene ordenada por
  // `updated_at DESC`, así que es el primero y no hace falta recorrer nada.
  const ultimoCambio = productos[0]?.actualizado;

  return [
    { url: urlAbsoluta("/"), lastModified: ultimoCambio },
    { url: urlAbsoluta("/productos"), lastModified: ultimoCambio },
    ...productos.map((p) => ({
      url: urlAbsoluta(`/productos/${p.slug}`),
      lastModified: p.actualizado,
    })),
  ];
}
