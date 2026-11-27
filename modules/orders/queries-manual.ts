import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import type { Money } from "@/lib/money";

/** Sin esto, buscar «50%» traería todo y «USB_C» encontraría cualquier cosa. */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

const TOPE = 12;

export type VarianteParaLaOrden = {
  variantId: string;
  nombre: string;
  marca: string;
  color: string | null;
  /** El vigente, con descuento aplicado. */
  precio: Money;
  disponible: number;
  /** El stock real: es lo que baja si la orden nace finalizada. */
  stock: number;
  /** Dados de baja se muestran igual: la venta manual puede ser la del último que quedaba. */
  inactiva: boolean;
};

/** Por nombre de producto o de marca; devuelve variantes, no productos. */
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
        LEFT JOIN variant_colors c ON c.variant_id = v.id
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
  direcciones: (ShippingAddressSnapshot & { id: string; label: string })[];
};

/** Por nombre o email. Excluye bloqueados y cuentas con baja pedida. */
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
