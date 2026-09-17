import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ShippingAddressSnapshot } from "@/db/schema/orders";
import { ZONA_HORARIA } from "@/lib/fechas";
import type { Money } from "@/lib/money";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  estadoDeLaSolapa,
  POR_PAGINA,
  type FiltrosDeOrdenes,
  type Solapa,
} from "@/modules/orders/filtros-panel";
import type { ItemDeLaOrden } from "@/modules/orders/queries";

/**
 * Lecturas de órdenes para el panel — FS RF-21 · TS §5.6. Tarea F7.1.
 *
 * **La contracara de `queries.ts`, que es el lado del comprador.** Aquéllas
 * filtran siempre por `user_id` porque sin RLS es la única barrera (§13.8);
 * éstas no filtran por nadie, y por eso no pueden compartirse: la guardia es
 * el layout de `/admin`, que verifica el rol contra la base en cada petición.
 * Un archivo con las dos mitades invitaría a llamar a la que no corresponde.
 */

export type OrigenDeOrden = "web" | "manual";

export type OrdenDelListado = {
  numero: number;
  estado: EstadoOrden;
  origen: OrigenDeOrden;
  /** ISO, como la devuelve el driver con SQL crudo. */
  creadaEn: string;
  customerName: string;
  customerEmail: string | null;
  total: Money;
  /**
   * Las unidades, no los renglones — y RF-21 dice «cantidad de ítems», que
   * admite las dos lecturas. Se elige ésta porque es la que contesta la
   * pregunta que se hace mirando el listado: cuántas cosas hay que poner en
   * la caja. Los renglones se ven en el detalle, que es donde importan.
   */
  unidades: number;
  /** Con dirección es un envío; sin ella, un retiro (`entrega.ts`). */
  shippingAddress: object | null;
};

/**
 * Los comodines de `ILIKE` se escapan antes de entrar a la consulta: sin
 * esto, buscar «50%» traería todo.
 */
function escaparComodines(termino: string): string {
  return termino.replace(/[\\%_]/g, "\\$&");
}

/**
 * Búsqueda por número de orden, nombre o email del comprador — RF-21.
 *
 * **El número se compara exacto y los textos por subcadena.** Buscar «104» no
 * tiene que traer la orden #1043: el número es un identificador, y quien lo
 * escribe está yendo a una orden, no explorando. El `#` de adelante se
 * descarta porque es como se escribe en todas las pantallas del proyecto.
 *
 * Los textos llevan `unaccent`, igual que el buscador de productos: «Gomez»
 * tiene que encontrar a «Gómez». Y `coalesce` sobre el email porque las
 * órdenes manuales pueden no tener ninguno (RF-24).
 */
function condicionDeBusqueda(q: string): SQL {
  const termino = sql`immutable_unaccent(lower(${escaparComodines(q)}))`;
  const soloDigitos = q.replace(/^#/, "");
  const porNumero = /^\d{1,9}$/.test(soloDigitos)
    ? sql`o.order_number = ${Number.parseInt(soloDigitos, 10)} OR `
    : sql``;

  return sql`(
    ${porNumero}
       immutable_unaccent(lower(o.customer_name))              ILIKE '%' || ${termino} || '%'
    OR immutable_unaccent(lower(coalesce(o.customer_email, ''))) ILIKE '%' || ${termino} || '%'
  )`;
}

/**
 * Qué fecha recorta el rango, según la solapa — decisión tuya del 2026-09-17,
 * tarea F7.8.
 *
 * **La del estado que la solapa muestra.** En «Finalizadas», «desde el 1°»
 * quiere decir «¿qué vendí este mes?», y no «de lo que cargué este mes, qué
 * ya cerré», que es una pregunta que no se hace nadie. Lo mismo en
 * «Canceladas». En «Activas» no hay otra fecha que la de carga, y «Todas»
 * mezcla los tres estados, así que las dos se quedan con `created_at`.
 *
 * **Lo cambió F7.8 y el motivo vino de afuera**: el tablero cuenta las ventas
 * del mes por `finalized_at`, como manda RF-28 —la venta ocurre cuando se
 * entrega—, y enlaza a este listado. Con el rango mirando `created_at`, una
 * orden cargada en agosto y entregada en septiembre entraba en el número y no
 * aparecía en el listado que ese número abre. Un tablero que abre otra cosa de
 * la que dice es peor que no tener tablero.
 */
function columnaDelRango(solapa: Solapa): SQL {
  if (solapa === "finalizadas") return sql`o.finalized_at`;
  if (solapa === "canceladas") return sql`o.cancelled_at`;
  return sql`o.created_at`;
}

/**
 * El `WHERE` de los filtros, compartido por el listado y por el conteo: son
 * dos consultas que tienen que contestar sobre el mismo conjunto, y con la
 * condición escrita dos veces un día dejarían de hacerlo.
 *
 * **El rango de fechas incluye el día de `hasta` entero.** `created_at` es un
 * instante y `hasta` es un día: con `<= hasta::date` se perdería todo lo del
 * mismo día pasadas las 00:00, que es prácticamente todo. Se compara contra
 * el día siguiente.
 *
 * **Y los dos cortes van `AT TIME ZONE` a la zona del negocio**, la misma con
 * la que la pantalla imprime cada fecha (`lib/fechas.ts`). El servidor corre
 * en UTC: sin esto, una orden de las 22:00 de un lunes en Argentina se
 * mostraría como del lunes y se contaría en el martes, y el filtro dejaría de
 * coincidir con la columna de al lado.
 */
function condiciones(filtros: FiltrosDeOrdenes): SQL {
  const partes: SQL[] = [];
  const cuando = columnaDelRango(filtros.solapa);

  const estado = estadoDeLaSolapa(filtros.solapa);
  if (estado) partes.push(sql`o.status = ${estado}`);
  if (filtros.origen !== "todos") {
    partes.push(sql`o.origin = ${filtros.origen}`);
  }
  if (filtros.q) partes.push(condicionDeBusqueda(filtros.q));
  if (filtros.desde) {
    partes.push(sql`${cuando} >=
      (${filtros.desde}::date)::timestamp AT TIME ZONE ${ZONA_HORARIA}`);
  }
  if (filtros.hasta) {
    partes.push(sql`${cuando} <
      (${filtros.hasta}::date + 1)::timestamp AT TIME ZONE ${ZONA_HORARIA}`);
  }

  return partes.length
    ? sql`WHERE ${sql.join(partes, sql` AND `)}`
    : sql`WHERE true`;
}

/**
 * El listado, de la más nueva a la más vieja, y cuántas hay en total.
 *
 * **Paginado** (F7.1). El listado de productos no lo está y éste sí, porque
 * los productos son los que la vendedora carga —unos cientos, con techo— y
 * las órdenes se acumulan solas: a los dos años, «Todas» sería un `SELECT` de
 * miles de filas para mirar las diez de arriba.
 *
 * Las dos consultas salen juntas: son independientes y encadenarlas agregaría
 * una ida y vuelta a la base por cada carga de la pantalla.
 */
export async function listarOrdenesDelPanel(
  filtros: FiltrosDeOrdenes,
): Promise<{ ordenes: OrdenDelListado[]; total: number }> {
  const where = condiciones(filtros);

  const [filas, [conteo]] = await Promise.all([
    db.execute<OrdenDelListado>(sql`
      SELECT o.order_number     AS numero,
             o.status           AS estado,
             o.origin           AS origen,
             o.created_at       AS "creadaEn",
             o.customer_name    AS "customerName",
             o.customer_email   AS "customerEmail",
             o.total,
             o.shipping_address AS "shippingAddress",
             (SELECT coalesce(sum(i.quantity), 0)::int
                FROM order_items i WHERE i.order_id = o.id) AS unidades
        FROM orders o
        ${where}
       ORDER BY o.created_at DESC, o.order_number DESC
       LIMIT ${POR_PAGINA} OFFSET ${(filtros.pagina - 1) * POR_PAGINA}`),
    db.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM orders o ${where}`),
  ]);

  return { ordenes: [...filas], total: conteo.total };
}

/** Cuántas hay en cada solapa, para el contador de arriba. */
export async function contarPorEstado(): Promise<Record<EstadoOrden, number>> {
  const filas = await db.execute<{ estado: EstadoOrden; n: number }>(sql`
    SELECT status AS estado, count(*)::int AS n FROM orders GROUP BY status`);

  const conteo: Record<EstadoOrden, number> = {
    activa: 0,
    finalizada: 0,
    cancelada: 0,
  };
  for (const fila of filas) conteo[fila.estado] = fila.n;
  return conteo;
}

// ── El detalle (RF-21) ──────────────────────────────────────────────────

/**
 * Una transición, con quién la hizo — RF-13, RF-23.
 *
 * **`esElComprador` no sale del rol de quien la hizo sino de comparar su id
 * con el dueño de la orden.** El rol es el de hoy: una compradora que mañana
 * sea administradora haría que su arrepentimiento del año pasado se lea como
 * una cancelación de la vendedora. El dueño de la orden no cambia.
 */
export type EntradaDelHistorial = {
  desde: EstadoOrden | null;
  hacia: EstadoOrden;
  motivo: string | null;
  /** El nombre del perfil, o `null` si la hizo el sistema o el perfil ya no está. */
  autor: string | null;
  esElComprador: boolean;
  cuando: string;
};

/**
 * Un renglón de la orden, con **los dos contadores de esa variante hoy**.
 *
 * El renglón es el snapshot de RN-12 y no cambia; estos dos son del catálogo
 * vivo y sí. Van juntos porque las acciones del panel los necesitan juntos, y
 * **cada una mira uno distinto**:
 *
 * - `disponible` (total − reservado) es el de RF-22 y el de cancelar: soltar
 *   una reserva no toca el stock real, sólo vuelve a dejar libre lo que
 *   estaba apartado.
 * - `stock` es el total real, y es el que mira **finalizar** (RF-23): la venta
 *   baja el total y la reserva a la vez, así que el disponible queda igual y
 *   lo que cambia es este otro. Decir «el disponible pasa de 9 a 7» al
 *   finalizar sería mentir.
 *
 * Los dos en `null` cuando la variante ya no existe (§5.6): ahí no hay
 * contador que mover.
 */
export type ItemDeLaOrdenDelPanel = ItemDeLaOrden & {
  disponible: number | null;
  stock: number | null;
};

export type OrdenDelPanel = {
  numero: number;
  estado: EstadoOrden;
  origen: OrigenDeOrden;
  creadaEn: string;
  finalizadaEn: string | null;
  canceladaEn: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  shippingAddress: ShippingAddressSnapshot | null;
  notas: string | null;
  total: Money;
  unidades: number;
  items: ItemDeLaOrdenDelPanel[];
  /**
   * La cuenta del comprador, cuando la orden salió de la web. `null` en las
   * manuales de alguien sin cuenta (RF-24). **No es lo mismo que el snapshot
   * de arriba**: el nombre y el teléfono del pedido valen sólo para ese
   * pedido (F6.1), y quien compró para un tercero puso los datos del tercero.
   */
  cuenta: { id: string; nombre: string; email: string } | null;
  historial: EntradaDelHistorial[];
};

/**
 * Una orden entera, por su número — RF-21.
 *
 * Los ítems y el historial vienen como subconsultas en la misma ida a la
 * base, con los montos casteados a `::text`: `json_build_object` convertiría
 * un `numeric` a número de JavaScript y ahí se pierden centavos (`Money` es
 * una cadena de punta a punta, §6).
 */
export async function leerOrdenDelPanel(
  numero: number,
): Promise<OrdenDelPanel | null> {
  const [fila] = await db.execute<Omit<OrdenDelPanel, "unidades">>(sql`
    SELECT o.order_number     AS numero,
           o.status           AS estado,
           o.origin           AS origen,
           o.created_at       AS "creadaEn",
           o.finalized_at     AS "finalizadaEn",
           o.cancelled_at     AS "canceladaEn",
           o.customer_name    AS "customerName",
           o.customer_email   AS "customerEmail",
           o.customer_phone   AS "customerPhone",
           o.shipping_address AS "shippingAddress",
           o.notes            AS notas,
           o.total,
           CASE WHEN p.id IS NULL THEN NULL ELSE
             json_build_object('id', p.id, 'nombre', p.full_name,
                               'email', p.email)
           END AS cuenta,
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'id',             i.id,
                         'nombre',         i.product_name,
                         'marca',          i.brand_name,
                         'color',          i.color_name,
                         'cantidad',       i.quantity,
                         'precioUnitario', i.unit_price::text,
                         'subtotal',       i.subtotal::text,
                         'disponible',     CASE WHEN v.id IS NULL THEN NULL
                                                ELSE v.stock_total
                                                     - v.reserved_stock END,
                         'stock',          v.stock_total
                       )
                       ORDER BY i.product_name, i.color_name
                     ),
                     '[]'::json)
              FROM order_items i
              LEFT JOIN product_variants v ON v.id = i.variant_id
             WHERE i.order_id = o.id) AS items,
           (SELECT coalesce(
                     json_agg(
                       json_build_object(
                         'desde',         h.from_status,
                         'hacia',         h.to_status,
                         'motivo',        h.reason,
                         'autor',         a.full_name,
                         'esElComprador', h.actor_user_id IS NOT NULL
                                          AND h.actor_user_id = o.user_id,
                         'cuando',        h.created_at
                       )
                       ORDER BY h.created_at, h.id
                     ),
                     '[]'::json)
              FROM order_status_history h
              LEFT JOIN user_profiles a ON a.id = h.actor_user_id
             WHERE h.order_id = o.id) AS historial
      FROM orders o
      LEFT JOIN user_profiles p ON p.id = o.user_id
     WHERE o.order_number = ${numero}`);

  if (!fila) return null;

  // Se suma sobre los renglones que ya vinieron: una segunda subconsulta
  // sobre la misma tabla puede discrepar el día que una cambie y la otra no.
  const unidades = fila.items.reduce((suma, item) => suma + item.cantidad, 0);
  return { ...fila, unidades };
}

/**
 * El `id` de una orden a partir de su número, que es lo que viaja en la URL.
 *
 * **Sin filtrar por nadie**, al revés de `idDeMiOrden` (§13.8): el panel ve
 * todas las órdenes, y quién puede llamarlo lo decide el `.auth("admin")` del
 * envoltorio de acciones. Son dos funciones parecidas con garantías
 * distintas, y por eso viven en archivos distintos.
 */
export async function idDeLaOrden(numero: number): Promise<string | null> {
  const [fila] = await db.execute<{ id: string }>(sql`
    SELECT id FROM orders WHERE order_number = ${numero}`);
  return fila?.id ?? null;
}
