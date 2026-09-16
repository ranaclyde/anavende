import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { domainError, isDomainError } from "@/lib/errors";
import type { Money } from "@/lib/money";
import {
  reservar,
  vender,
  type Transaccion,
} from "@/modules/stock/operaciones";

/**
 * Alta de una orden manual — FS RF-24 · TS §5.6, §8.1. Tarea F7.4.
 *
 * La venta que no pasó por la web: se arregló por WhatsApp o se hizo en el
 * mostrador, y se carga acá para que el stock siga diciendo la verdad.
 *
 * **Se parece a `crear.ts` y no es lo mismo, en cuatro puntos que importan:**
 *
 * 1. **No hay carrito ni nada que reconfirmar.** La orden web se arma contra
 *    lo que el comprador vio (§8.4 paso 3); acá la vendedora escribe lo que
 *    pasó, y no hay una pantalla previa contra la cual comparar.
 * 2. **El precio lo pone ella** (RF-24): es el acordado, no el del catálogo.
 *    El catálogo aporta el precio de arranque y el snapshot del nombre.
 * 3. **Puede nacer finalizada**, y entonces el stock se descuenta de una sin
 *    pasar por la reserva (§8.1). Ahí es donde el total **puede quedar
 *    negativo**: §5.4 lo decidió a propósito, porque bloquear una venta ya
 *    ocurrida obligaría a mentirle al sistema. El negativo es la señal de
 *    discrepancia que el panel destaca.
 * 4. **Sin clave de idempotencia** (§5.6): las manuales no la llevan. Las
 *    carga una persona de a una, y el índice único es parcial justamente
 *    para dejar ese hueco dicho.
 *
 * **Lo que sí comparte es el orden de los pasos y el `ORDER BY variant_id`**
 * (§8.3 regla 2): dos altas que toquen los mismos colores en distinto orden
 * se traban mutuamente, y ese ciclo no se forma si todos recorren igual.
 */

export type ItemManual = {
  variantId: string;
  quantity: number;
  /** El acordado (RF-24), que puede no ser el del catálogo. */
  unitPrice: Money;
};

export type DatosDeOrdenManual = {
  /** La administradora que la carga: queda en `created_by`. */
  creadaPor: string;
  /**
   * La cuenta del comprador, si la tiene y se la quiso asociar (RF-24). Con
   * cuenta, la orden le aparece en «Mis compras» como cualquier otra.
   */
  userId: string | null;
  /** Activa reserva; finalizada descuenta de una (§8.1). */
  estado: "activa" | "finalizada";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  /** Con dirección es envío; `null` es retiro (§5.6, 2026-09-14). */
  direccion: ShippingAddressSnapshot | null;
  notas: string | null;
  items: readonly ItemManual[];
};

type VarianteParaLaOrden = {
  variantId: string;
  productName: string;
  brandName: string;
  colorName: string | null;
};

/**
 * El snapshot de cada variante, leído del catálogo vivo una sola vez.
 *
 * **Se traen todas juntas y no de a una**: son tantas idas a la base como
 * renglones, y además una consulta por renglón dentro de la transacción la
 * mantiene abierta más tiempo del necesario.
 */
async function snapshotDeLasVariantes(
  tx: Transaccion,
  ids: readonly string[],
): Promise<Map<string, VarianteParaLaOrden>> {
  const filas = await tx.execute<VarianteParaLaOrden>(sql`
    SELECT v.id        AS "variantId",
           p.name      AS "productName",
           b.name      AS "brandName",
           c.name      AS "colorName"
      FROM product_variants v
      JOIN products p    ON p.id = v.product_id
      JOIN brands b      ON b.id = p.brand_id
      LEFT JOIN colors c ON c.id = v.color_id
     WHERE v.id IN (${sql.join(
       ids.map((id) => sql`${id}::uuid`),
       sql`, `,
     )})`);

  return new Map([...filas].map((f) => [f.variantId, f]));
}

/**
 * Crea la orden manual entera, o ninguna (§8.3 regla 1).
 *
 * Abre su propia transacción, como `crearOrdenDesdeCarrito`: quien llama es
 * una acción, y todo lo que hay que hacer cabe adentro.
 */
export async function crearOrdenManual(
  datos: DatosDeOrdenManual,
): Promise<{ orderId: string; orderNumber: number }> {
  if (datos.items.length === 0) {
    throw domainError("VALIDATION", {
      message: "Agregá al menos un producto a la orden.",
    });
  }

  // §8.3 regla 2. Se ordena una sola vez, acá, y los pasos que siguen van
  // sobre esta lista: el snapshot, los renglones y el stock.
  const items = [...datos.items].sort((a, b) =>
    a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0,
  );

  return db.transaction(async (tx) => {
    const catalogo = await snapshotDeLasVariantes(
      tx,
      items.map((i) => i.variantId),
    );

    // Una variante que no existe no es un error de escritura: es una pantalla
    // vieja, o un producto borrado entre que se buscó y se guardó.
    const faltante = items.find((i) => !catalogo.has(i.variantId));
    if (faltante) {
      throw domainError("NOT_FOUND", {
        message:
          "Uno de los productos de la orden ya no está en el catálogo. " +
          "Quitalo de la lista y volvé a buscarlo.",
      });
    }

    const [orden] = await tx.execute<{ id: string; orderNumber: number }>(sql`
      INSERT INTO orders
        (user_id, origin, status, customer_name, customer_email,
         customer_phone, shipping_address, notes, created_by, finalized_at)
      VALUES
        (${datos.userId}, 'manual', ${datos.estado}, ${datos.customerName},
         ${datos.customerEmail}, ${datos.customerPhone},
         ${datos.direccion ? JSON.stringify(datos.direccion) : null}::jsonb,
         ${datos.notas}, ${datos.creadaPor},
         ${datos.estado === "finalizada" ? sql`now()` : sql`NULL`})
      RETURNING id, order_number AS "orderNumber"`);

    for (const item of items) {
      const v = catalogo.get(item.variantId)!;

      await tx.execute(sql`
        INSERT INTO order_items
          (order_id, variant_id, product_name, brand_name, color_name,
           unit_price, quantity)
        VALUES
          (${orden.id}, ${item.variantId}, ${v.productName}, ${v.brandName},
           ${v.colorName}, ${item.unitPrice}, ${item.quantity})`);

      await moverElStock(tx, {
        estado: datos.estado,
        item,
        nombre: v.colorName
          ? `${v.productName} (${v.colorName.toLowerCase()})`
          : v.productName,
        orderId: orden.id,
        actorUserId: datos.creadaPor,
      });
    }

    // El total se suma EN SQL (§7.1): un `reduce` sobre estos montos pierde
    // centavos, y eso no se ve hasta que una orden no cierra.
    await tx.execute(sql`
      UPDATE orders
         SET total = (SELECT COALESCE(SUM(subtotal), 0)
                        FROM order_items WHERE order_id = ${orden.id})
       WHERE id = ${orden.id}`);

    // **Una sola fila, y con el estado en el que nació.** Una manual cargada
    // como finalizada nunca estuvo activa: escribir `NULL → activa` y después
    // `activa → finalizada` sería inventarle un pasado que no tuvo. La
    // pantalla lo lee y dice «Se creó la orden, ya finalizada» (F7.1).
    await tx.execute(sql`
      INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_user_id)
      VALUES (${orden.id}, NULL, ${datos.estado}, ${datos.creadaPor})`);

    return { orderId: orden.id, orderNumber: orden.orderNumber };
  });
}

/**
 * El efecto en stock de cada renglón, que es distinto según cómo nace (§8.1).
 *
 * **Activa**: reserva, con el `UPDATE` condicional de §8.2 — y si no hay
 * disponible, no hay reserva posible. `reserved_within_total` impide
 * comprometer unidades que no existen, y eso **no** es el «advierte sin
 * bloquear» de RF-24: reservar de más no registra una venta ocurrida, promete
 * una entrega que no se va a poder hacer. El error dice qué hacer en su
 * lugar.
 *
 * **Finalizada**: vende sin pasar por la reserva, y ahí sí el total puede
 * quedar negativo (§5.4). Es el caso que RF-24 quiere permitir: la venta ya
 * pasó, el sistema se enteró tarde.
 */
async function moverElStock(
  tx: Transaccion,
  args: {
    estado: "activa" | "finalizada";
    item: ItemManual;
    nombre: string;
    orderId: string;
    actorUserId: string;
  },
): Promise<void> {
  const comun = {
    variantId: args.item.variantId,
    quantity: args.item.quantity,
    orderId: args.orderId,
    actorUserId: args.actorUserId,
  };

  try {
    if (args.estado === "activa") {
      await reservar(tx, { ...comun, note: "Orden manual" });
    } else {
      await vender(tx, {
        ...comun,
        desdeReserva: false,
        note: "Orden manual finalizada",
      });
    }
  } catch (e: unknown) {
    if (!isDomainError(e) || e.code !== "INSUFFICIENT_STOCK") throw e;

    // El mensaje genérico habla de «ese producto» y de revisar el carrito.
    // Acá se sabe cuál es y quién está mirando, y las dos salidas son otras.
    throw domainError("INSUFFICIENT_STOCK", {
      variantId: args.item.variantId,
      message:
        args.estado === "activa"
          ? `No hay stock libre suficiente de «${args.nombre}» para reservarlo. ` +
            "Si la venta ya se hizo, cargala como finalizada; si no, ajustá el stock primero."
          : `Esa cantidad de «${args.nombre}» dejaría el stock por debajo de lo ` +
            "reservado en órdenes activas. Resolvé esas órdenes primero.",
    });
  }
}
