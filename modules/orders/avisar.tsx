import "server-only";

import { after } from "next/server";
import { render } from "react-email";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { enviarEmail, type Email } from "@/lib/email/enviar";
import {
  NuevaOrden,
  type ItemDelAviso,
  type PropsDeNuevaOrden,
} from "@/lib/email/plantillas/nueva-orden";
import { formatMoney, type Money } from "@/lib/money";
import { formaDeEntrega } from "@/modules/orders/entrega";
import { emailDeAvisos } from "@/modules/settings/queries";

/**
 * E4, el aviso de nueva orden a la administradora — FS RF-30 · TS §14.
 * Tarea F6.4.
 *
 * **Va después del COMMIT y nunca lo revierte** (§8.4 paso 10, RF-12). Todo lo
 * que puede salir mal acá —que no haya casilla configurada, que Resend esté
 * caído, que la orden se haya borrado en el medio— termina en `false` y en un
 * registro, nunca en una excepción que suba: para el comprador la orden ya
 * está hecha, y un error en su pantalla no le diría nada que pueda resolver.
 *
 * Por eso la función entera va envuelta en un `try`. Es el único lugar del
 * proyecto donde eso es lo correcto y no una forma de tapar errores: acá
 * *nada* justifica romper la confirmación de una compra que ya ocurrió.
 */

/**
 * Agendar el aviso para después de la respuesta, sin que nada de eso pueda
 * romper la confirmación de la compra.
 *
 * **El `try` es por `after` y no por el email.** `after()` lanza si lo llaman
 * fuera de una petición, y el envoltorio de acciones convierte cualquier
 * excepción en un `INTERNAL` que el comprador ve como «no pudimos completar la
 * acción» — con la orden ya creada, el stock reservado y el carrito vacío. Es
 * exactamente lo que RF-30 prohíbe: un fallo del aviso no puede volverse un
 * fallo de la operación.
 *
 * Que hoy eso solo pase en los tests es justamente el motivo por el que
 * conviene que esté: la garantía no puede depender de que el único llamador
 * siga estando donde está.
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
    return await enviarEmail(aviso);
  } catch (e) {
    // Importa que quede, no que se lea acá: `enviarEmail` ya reporta lo suyo,
    // así que esto solo atrapa lo que pase ANTES —la lectura, el render—.
    console.error(`[email] No se pudo avisar la orden ${orderId}:`, e);
    return false;
  }
}

/**
 * El email listo para mandar, o `null` si no hay a quién o qué mandar.
 *
 * Está separado del envío porque es la mitad que tiene las decisiones y
 * ninguna red: `enviarEmail` es un `fetch` con dos campos.
 */
export async function armarElAviso(orderId: string): Promise<Email | null> {
  const datos = await datosDelAviso(orderId);
  if (!datos) return null;
  const { props, ...sobre } = datos;
  return { ...sobre, html: await render(<NuevaOrden {...props} />) };
}

/**
 * Todo lo que decide este módulo, **sin renderizar**: a quién le llega, qué
 * dice el asunto y qué valores entran en la plantilla.
 *
 * **Está partido en dos por los tests, y vale la pena decir por qué.** El
 * `render` de React Email necesita `react-dom/server`, que bajo la condición
 * `react-server` no existe — y los tests corren con esa condición puesta
 * porque medio proyecto lleva `server-only` (ver `vitest.config.mts`). En la
 * aplicación no pasa: Next resuelve el paquete bien y el email se arma
 * entero; se comprobó confirmando un pedido de verdad contra el stack local.
 *
 * Antes que aflojar la condición del harness para un solo archivo, se partió
 * acá: lo que puede romperse en silencio son los datos —un campo que deja de
 * llegar, un monto sin formatear—, y eso es justo lo que queda probado. La
 * plantilla se mira, que es como se revisa un email.
 */
export async function datosDelAviso(
  orderId: string,
): Promise<(Omit<Email, "html"> & { props: PropsDeNuevaOrden }) | null> {
  const [casilla, orden] = await Promise.all([
    emailDeAvisos(),
    leerOrdenParaElAviso(orderId),
  ]);

  // Sin fila en `site_settings` no hay a dónde mandarlo (§5.9). No es un
  // error: es una tienda que todavía no se terminó de configurar, y la
  // pantalla de Configuración ya lo dice.
  if (!casilla) {
    console.warn(
      `[email] Sin email de avisos configurado: no se avisa la orden ${orderId}.`,
    );
    return null;
  }
  if (!orden) return null;

  return {
    para: casilla,
    // El número primero: es lo que se busca cuando hay veinte en la bandeja.
    asunto: `Pedido #${orden.numero} de ${orden.customerName} — ${formatMoney(orden.total)}`,
    referencia: `orden #${orden.numero}`,
    props: {
      sitio: SITIO,
      numero: orden.numero,
      comprador: orden.customerName,
      telefono: orden.customerPhone,
      email: orden.customerEmail,
      items: orden.items.map(comoItemDelAviso),
      total: formatMoney(orden.total),
      entrega: comoEntrega(orden.shippingAddress),
      // Hasta F7.1 no hay detalle de orden en el panel, así que el botón lleva
      // al inicio y no a una dirección que daría 404. Cuando exista, acá va
      // `/admin/ordenes/${orderId}` y el email cumple RF-30 al pie de la letra.
      enlace: `${SITIO}/admin`,
    },
  };
}

/**
 * `NEXT_PUBLIC_SITE_URL` y no el encabezado `Host` de la petición.
 *
 * El email se arma dentro de `after()`, cuando la respuesta ya salió, y sobre
 * todo: lo abre otra persona en otro momento. Un enlace armado con el host de
 * quien compró apuntaría a donde entró él, que detrás del proxy no siempre es
 * el dominio público.
 */
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

/**
 * Por `id` y sin filtrar por comprador, al revés que todo lo demás en
 * `queries.ts`: acá no hay una sesión que pueda estar pidiendo algo ajeno. El
 * `id` viene de la orden que esta misma petición acaba de crear, y quien lee
 * es el servidor para avisarle a la administradora.
 */
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

/** Los montos se formatean acá y llegan hechos a la plantilla (§7.1). */
function comoItemDelAviso(
  item: OrdenParaElAviso["items"][number],
): ItemDelAviso {
  return {
    nombre: item.nombre,
    marca: item.marca,
    color: item.color,
    cantidad: item.cantidad,
    precioUnitario: formatMoney(item.precioUnitario),
    subtotal: formatMoney(item.subtotal),
  };
}

/**
 * Una línea que diga a dónde va, o que se retira.
 *
 * **Lleva la dirección entera, con piso y aclaraciones**: es lo que Ana copia
 * para el mensajero, y un dato que falta ahí es un viaje perdido. El retiro no
 * dice dónde porque el punto de entrega lo pasa ella (RN-10).
 */
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
