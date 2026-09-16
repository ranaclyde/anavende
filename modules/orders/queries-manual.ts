import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import type { Money } from "@/lib/money";

/**
 * Los dos buscadores del alta manual — FS RF-24. Tarea F7.4.
 *
 * **El de variantes es la pieza que F7.2a espera** (sumar productos a una
 * orden activa): por eso vive acá y no adentro del componente, y por eso
 * devuelve también los dos contadores de stock, que es lo que las dos
 * pantallas necesitan mostrar antes de agregar nada.
 *
 * Las dos búsquedas son **por subcadena y sin similitud**, como el buscador
 * de productos del panel: la vendedora busca algo que sabe que existe, y un
 * resultado «parecido» le esconde lo que fue a buscar (F2.5).
 */

/** Sin esto, buscar «50%» traería todo y «USB_C» encontraría cualquier cosa. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/** Cuántos resultados alcanzan para elegir sin convertirlo en un catálogo. */
const TOPE = 12;

export type VarianteParaLaOrden = {
  variantId: string;
  nombre: string;
  marca: string;
  color: string | null;
  /** El vigente, con descuento aplicado: es el que propone el formulario. */
  precio: Money;
  /** Total − reservado: lo que se puede comprometer sin pisar otra orden. */
  disponible: number;
  /** El stock real, que es lo que baja si la orden nace finalizada (§8.1). */
  stock: number;
  /**
   * Producto o variante dados de baja. **Se muestran igual**: una venta
   * manual puede ser justamente la del último que quedaba de algo que ya se
   * sacó del catálogo. Se marcan para que no se elija uno sin querer.
   */
  inactiva: boolean;
};

/**
 * Variantes que coinciden con lo que se escribió, por producto o por marca.
 *
 * **Devuelve variantes y no productos**, al revés del listado del panel: lo
 * que se agrega a una orden es un color concreto, y hacer elegir primero el
 * producto y después el color serían dos pasos donde alcanza con uno.
 */
export async function buscarVariantesParaLaOrden(
  q: string,
): Promise<VarianteParaLaOrden[]> {
  const termino = q.trim();
  if (termino.length < 2) return [];

  const patron = sql`immutable_unaccent(lower(${escaparComodines(termino)}))`;

  return [
    ...(await db.execute<VarianteParaLaOrden>(sql`
      SELECT v.id            AS "variantId",
             p.name          AS nombre,
             b.name          AS marca,
             c.name          AS color,
             p.final_price   AS precio,
             v.stock_total - v.reserved_stock AS disponible,
             v.stock_total   AS stock,
             NOT (p.is_active AND v.is_active) AS inactiva
        FROM product_variants v
        JOIN products p    ON p.id = v.product_id
        JOIN brands b      ON b.id = p.brand_id
        LEFT JOIN colors c ON c.id = v.color_id
       WHERE immutable_unaccent(lower(p.name)) ILIKE '%' || ${patron} || '%'
          OR immutable_unaccent(lower(b.name)) ILIKE '%' || ${patron} || '%'
       -- Lo vendible primero, y después por nombre: buscando «teclado», lo
       -- que no se puede entregar no tiene por qué encabezar la lista.
       ORDER BY (p.is_active AND v.is_active) DESC, p.name, c.name
       LIMIT ${TOPE}`)),
  ];
}

export type CompradorParaLaOrden = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  /**
   * Sus direcciones guardadas, listas para usar como snapshot de la orden
   * (decisión tuya del 2026-09-16). Son tres como mucho
   * (`MAXIMO_DE_DIRECCIONES`), así que traerlas con el resultado sale más
   * barato que una segunda vuelta a la base cuando se elige una.
   */
  direcciones: (ShippingAddressSnapshot & { id: string; label: string })[];
};

/**
 * Compradores registrados, por nombre o email — RF-24, «opcionalmente se
 * puede asociar a un comprador registrado».
 *
 * **No aparecen los bloqueados ni los que pidieron la baja.** Asociarle una
 * orden nueva a una cuenta que está saliendo del sistema es prometer un
 * «Mis compras» que no va a poder abrir (RF-27, RF-34): la venta se carga
 * igual, sin cuenta, que es lo que RF-24 permite desde el principio.
 */
export async function buscarCompradoresParaLaOrden(
  q: string,
): Promise<CompradorParaLaOrden[]> {
  const termino = q.trim();
  if (termino.length < 2) return [];

  const patron = sql`immutable_unaccent(lower(${escaparComodines(termino)}))`;

  return [
    ...(await db.execute<CompradorParaLaOrden>(sql`
      SELECT u.id,
             u.full_name AS nombre,
             u.email,
             u.phone     AS telefono,
             (SELECT coalesce(
                       json_agg(
                         json_build_object(
                           'id',            a.id,
                           'label',         a.label,
                           'recipientName', a.recipient_name,
                           'phone',         a.phone,
                           'street',        a.street,
                           'number',        a.number,
                           'apartment',     a.apartment,
                           'notes',         a.notes,
                           'city',          a.city,
                           'province',      a.province,
                           'postalCode',    a.postal_code
                         )
                         ORDER BY a.is_default DESC, a.created_at
                       ),
                       '[]'::json)
                FROM addresses a
               WHERE a.user_id = u.id) AS direcciones
        FROM user_profiles u
       WHERE NOT u.is_banned
         AND u.closure_requested_at IS NULL
         AND (immutable_unaccent(lower(u.full_name)) ILIKE '%' || ${patron} || '%'
              OR immutable_unaccent(lower(u.email))  ILIKE '%' || ${patron} || '%')
       ORDER BY u.full_name
       LIMIT ${TOPE}`)),
  ];
}
