import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Lo que va en `sitemap.xml` — F3.9, RNF-04.
 *
 * Una consulta sola y en su propio archivo: no comparte nada con el catálogo
 * —no filtra, no ordena por relevancia, no trae precios ni fotos— y meterla
 * en `tienda.ts` sería obligar a leer trescientas líneas de filtros para
 * entender un `SELECT slug`.
 *
 * **Solo productos activos** (RN-05): un producto desactivado da 404, y
 * ofrecerle a Google una dirección que devuelve 404 es pedirle que registre un
 * error nuestro.
 *
 * **Un producto sin variantes también entra.** La ficha lo muestra —RN-05 y
 * F3.5: dice «todavía no está a la venta»— así que es una página de verdad,
 * con su nombre y su descripción.
 */

/**
 * El tope del protocolo: 50.000 direcciones por archivo. No se espera llegar
 * —el catálogo de Ana son cientos—, pero una consulta pública sin `LIMIT` es
 * exactamente lo que se encontró en el listado del panel el 2026-09-18, y ahí
 * el tamaño lo ponía la cantidad de productos. El día que se supere hay que
 * partir el mapa con `generateSitemaps`, y el `LIMIT` es lo que hace que ese
 * día se note por lo que falta y no por un archivo que ningún buscador acepta.
 */
export const TOPE_DEL_MAPA = 50_000;

export type ProductoDelMapa = {
  slug: string;
  /**
   * `products.updated_at` ya formateada, que es lo que va tal cual adentro de
   * `<lastmod>`.
   *
   * **Es `string` y la arma Postgres, no JavaScript.** Una consulta cruda
   * devuelve los `timestamptz` como los escribe Postgres —`2026-09-22
   * 23:16:33.078552+00`—, con un espacio en el medio y sin la `T`, y Next
   * escribe en el mapa lo que reciba salvo que sea un `Date`. Eso da un
   * `<lastmod>` que no cumple el formato del protocolo y que los buscadores
   * descartan sin avisar. Convertirlo acá con `new Date()` también andaría,
   * pero sería confiarle a un parser de JavaScript un formato que Postgres
   * puede escribir bien de entrada.
   */
  actualizado: string;
};

export async function productosDelMapa(): Promise<ProductoDelMapa[]> {
  const filas = await db.execute<ProductoDelMapa>(sql`
    SELECT slug,
           to_char(updated_at AT TIME ZONE 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS actualizado
      FROM products
     WHERE is_active
     ORDER BY updated_at DESC
     LIMIT ${TOPE_DEL_MAPA}
  `);

  return [...filas];
}
