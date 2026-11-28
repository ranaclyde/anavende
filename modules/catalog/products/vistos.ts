import "server-only";

import { sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import type { ProductoEnTarjeta } from "@/components/shop/tarjeta-producto";
import {
  aTarjeta,
  COLUMNAS_DE_TARJETA,
  UNIONES_DE_TARJETA,
  type FilaDeTarjeta,
} from "@/modules/catalog/products/tienda";
import {
  COOKIE_DE_VISTOS,
  leerIds,
} from "@/modules/catalog/products/vistos-cookie";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Con menos de dos, el bloque no se muestra (RF-33). */
export const MINIMO_DE_VISTOS = 2;

/**
 * En el orden de la lista. Los inactivos se descartan acá y no de la cookie:
 * si la vendedora reactiva el producto, vuelve a aparecer.
 */
export async function tarjetasDeVistos(
  ids: readonly string[],
  excluir: string | null = null,
  ejecutor: Tx | typeof db = db,
): Promise<ProductoEnTarjeta[]> {
  const lista = ids.filter((id) => id !== excluir);
  if (lista.length < MINIMO_DE_VISTOS) return [];

  const arreglo = sql`ARRAY[${sql.join(
    lista.map((id) => sql`${id}::uuid`),
    sql`, `,
  )}]`;

  const filas = await ejecutor.execute<FilaDeTarjeta>(sql`
    SELECT ${COLUMNAS_DE_TARJETA}
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      ${UNIONES_DE_TARJETA}
     WHERE p.is_active
       AND p.id = ANY(${arreglo})
     ORDER BY array_position(${arreglo}, p.id)`);

  return filas.length < MINIMO_DE_VISTOS ? [] : filas.map(aTarjeta);
}

export async function leerVistos(
  excluir: string | null = null,
): Promise<ProductoEnTarjeta[]> {
  const almacen = await cookies();
  return tarjetasDeVistos(
    leerIds(almacen.get(COOKIE_DE_VISTOS)?.value),
    excluir,
  );
}
