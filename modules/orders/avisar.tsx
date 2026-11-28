import "server-only";

import { after } from "next/server";
import { render } from "react-email";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { sendEmail, type Email } from "@/lib/email/send";
import {
  NewOrder,
  type NoticeItem,
  type NewOrderProps,
} from "@/lib/email/templates/new-order";
import { formatMoney, type Money } from "@/lib/money";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { emailDeAvisos } from "@/modules/settings/queries";

/**
 * E4, el aviso de nueva orden a la administradora (RF-30). Va después del
 * COMMIT y nunca lo revierte: todo fallo termina en `false` y un registro,
 * nunca en una excepción que suba al comprador.
 */

/**
 * El `try` es por `after()`, que lanza fuera de una petición: el envoltorio lo
 * convertiría en un error para el comprador con la orden ya creada.
 */
export function avisarSinBloquear(orderId: string): void {
  try {
    after(() => avisarNuevaOrden(orderId));
  } catch (e) {
    console.error(`[email] No se pudo agendar el aviso de ${orderId}:`, e);
  }
}

/** `true` si el email salió. */
export async function avisarNuevaOrden(orderId: string): Promise<boolean> {
  try {
    const aviso = await armarElAviso(orderId);
    if (!aviso) return false;
    return await sendEmail(aviso);
  } catch (e) {
    // `sendEmail` ya reporta lo suyo: esto atrapa la lectura y el render.
    console.error(`[email] No se pudo avisar la orden ${orderId}:`, e);
    return false;
  }
}

/** `null` si no hay a quién o qué mandar. */
export async function armarElAviso(orderId: string): Promise<Email | null> {
  const datos = await datosDelAviso(orderId);
  if (!datos) return null;
  const { props, ...sobre } = datos;
  return { ...sobre, html: await render(<NewOrder {...props} />) };
}

/**
 * Los datos del aviso sin renderizar. Está separado de `armarElAviso` por los
 * tests: corren con la condición `react-server`, donde `render` no funciona
 * (ver `vitest.config.mts`).
 */
export async function datosDelAviso(
  orderId: string,
): Promise<(Omit<Email, "html"> & { props: NewOrderProps }) | null> {
  const [casilla, orden] = await Promise.all([
    emailDeAvisos(),
    leerOrdenParaElAviso(orderId),
  ]);

  // No es un error: la tienda todavía no se configuró.
  if (!casilla) {
    console.warn(
      `[email] Sin email de avisos configurado: no se avisa la orden ${orderId}.`,
    );
    return null;
  }
  if (!orden) return null;

  return {
    to: casilla,
    subject: `Pedido #${orden.numero} de ${orden.customerName} — ${formatMoney(orden.total)}`,
    reference: `orden #${orden.numero}`,
    props: {
      site: SITIO,
      orderNumber: orden.numero,
      customer: orden.customerName,
      phone: orden.customerPhone,
      email: orden.customerEmail,
      items: orden.items.map(comoItemDelAviso),
      total: formatMoney(orden.total),
      delivery: comoEntrega(orden.shippingAddress),
      link: `${SITIO}/admin/ordenes/${orden.numero}`,
    },
  };
}

/** No el `Host` de la petición: detrás del proxy no siempre es el dominio público. */
const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anavende.com.ar";

type OrdenParaElAviso = {
  numero: number;
  total: Money;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: ShippingAddressSnapshot | null;
  items: {
    nombre: string;
    marca: string;
    color: string | null;
    cantidad: number;
    precioUnitario: Money;
    subtotal: Money;
  }[];
};

/** Sin filtrar por comprador: el `id` viene de la orden que esta petición acaba de crear. */
async function leerOrdenParaElAviso(
  orderId: string,
): Promise<OrdenParaElAviso | null> {
  const [fila] = await db.execute<OrdenParaElAviso>(sql`
    SELECT o.order_number     AS numero,
           o.total,
           o.customer_name    AS "customerName",
           o.customer_phone   AS "customerPhone",
           o.customer_email   AS "customerEmail",
           o.shipping_address AS "shippingAddress",
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'nombre',         i.product_name,
                         'marca',          i.brand_name,
                         'color',          i.color_name,
                         'cantidad',       i.quantity,
                         'precioUnitario', i.unit_price::text,
                         'subtotal',       i.subtotal::text
                       )
                       ORDER BY i.product_name, i.color_name
                     ),
                     '[]'::json)
              FROM order_items i WHERE i.order_id = o.id) AS items
      FROM orders o
     WHERE o.id = ${orderId}`);
  return fila ?? null;
}

function comoItemDelAviso(item: OrdenParaElAviso["items"][number]): NoticeItem {
  return {
    name: item.nombre,
    brand: item.marca,
    color: item.color,
    quantity: item.cantidad,
    unitPrice: formatMoney(item.precioUnitario),
    subtotal: formatMoney(item.subtotal),
  };
}

function comoEntrega(direccion: ShippingAddressSnapshot | null): string {
  if (formaDeEntrega({ shippingAddress: direccion }) === "retiro") {
    return "Retira en el punto de entrega";
  }
  const d = direccion!;
  const partes = [
    `${d.street} ${d.number}`,
    d.apartment,
    d.city,
    d.province,
    d.postalCode,
  ].filter(Boolean);
  return `Envío a ${partes.join(", ")}${d.notes ? ` (${d.notes})` : ""}`;
}
