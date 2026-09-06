"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { productVariants } from "@/db/schema/catalog";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import {
  borrarArchivos,
  borrarImagenDeVariante,
  clavesDeVariante,
  reordenarImagenesDeVariante,
} from "@/modules/media/subir";
import { ajustar } from "@/modules/stock/operaciones";
import {
  crearVariante,
  editarVariante,
  fuenteDeImagenes,
  ordenDeImagenes,
  soloImagen,
  soloVariante,
} from "@/modules/catalog/variants/schemas";

/**
 * Variantes de color — RF-16, RF-17, RN-11, RN-11b, §8.1, §8.3, §9.5.
 *
 * Cuatro reglas viven acá porque no se ven en el formulario:
 *
 *   · **Cambiar el stock escribe en el libro mayor** (§8.3, regla 3). El
 *     ajuste de la vendedora es una de las operaciones de stock de §8.1, no
 *     un campo más. **Desde F4.1 lo hace `ajustar()`**, en `modules/stock`,
 *     igual que las otras cuatro: acá no se escribe `stock_total` ni se
 *     inserta un movimiento a mano. Un segundo lugar que toque el contador es
 *     un segundo lugar que puede olvidarse del asiento, y ahí se pierde la
 *     única forma de auditar la discrepancia.
 *   · **RN-11b, la parte de los colores.** Un producto activo no puede tener
 *     variantes activas de un color inactivo.
 *   · **No se quita una variante con stock reservado** (RF-16), y el mensaje
 *     dice qué órdenes la usan. Si no hay reservas pero alguna orden la
 *     nombra, se desactiva en vez de borrarse (RN-11), igual que un producto.
 *   · **Reutilizar imágenes es un solo salto** (§9.5): la fuente tiene que
 *     ser del mismo producto y no puede estar reutilizando a su vez.
 */

function refrescar() {
  revalidatePath("/admin/productos", "layout");
}

/** Postgres devuelve 23505; Drizzle envuelve el error (mismo caso que RF-18). */
function esDuplicado(e: unknown): boolean {
  let actual: unknown = e;
  for (let i = 0; i < 5 && actual; i++) {
    if (
      typeof actual === "object" &&
      "code" in actual &&
      (actual as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * El índice único es `(product_id, COALESCE(color_id, …))`: un color por
 * producto, y la variante única también. El mensaje habla de lo que la
 * vendedora ve —un color repetido— y no del índice.
 */
function siEsDuplicado(e: unknown): never {
  if (esDuplicado(e)) {
    throw domainError("VALIDATION", {
      message:
        "Ese color ya está cargado en este producto. Editá la variante que ya existe en vez de agregar otra.",
    });
  }
  throw e;
}

/**
 * RN-11b, la parte que le toca a las variantes: un producto ACTIVO no puede
 * tener variantes ACTIVAS de un color INACTIVO.
 *
 * Se consulta con el color que se va a guardar, no con el guardado: al
 * editar, el color puede estar cambiando en la misma operación.
 */
async function verificarColor(
  productId: string,
  colorId: string | null,
  varianteActiva: boolean,
) {
  // Sin color no hay nada que comprobar: la variante única no depende del
  // catálogo de colores.
  if (!colorId || !varianteActiva) return;

  const [fila] = await db.execute<{
    productoActivo: boolean;
    colorActivo: boolean | null;
  }>(sql`
    SELECT p.is_active AS "productoActivo",
           (SELECT is_active FROM colors WHERE id = ${colorId}) AS "colorActivo"
      FROM products p
     WHERE p.id = ${productId}`);

  if (!fila) throw domainError("NOT_FOUND");

  // `null` = el color no existe. La clave foránea lo rechazaría igual, pero
  // con un error de integridad en vez de una frase.
  if (fila.colorActivo === null) {
    throw domainError("NOT_FOUND", {
      message: "El color que elegiste ya no existe. Actualizá la página.",
    });
  }

  if (fila.productoActivo && !fila.colorActivo) {
    throw domainError("ENTITY_IN_USE", {
      message:
        "Ese color está inactivo, así que no puede tener una variante activa en un producto activo. Activá el color, o guardá la variante como inactiva.",
    });
  }
}

// ── Alta ────────────────────────────────────────────────────────────────

export const agregarUnaVariante = action
  .input(crearVariante)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    await verificarColor(input.productId, input.colorId, input.isActive);

    try {
      const id = await db.transaction(async (tx) => {
        const [{ n }] = await tx.execute<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM product_variants
           WHERE product_id = ${input.productId}`);

        const [fila] = await tx
          .insert(productVariants)
          .values({
            productId: input.productId,
            colorId: input.colorId,
            // Nace en cero: el número que escribió la vendedora entra abajo,
            // como movimiento.
            isActive: input.isActive,
            sortOrder: n,
          })
          .returning({ id: productVariants.id });

        // El stock inicial es un ajuste como cualquier otro (§8.1): entra al
        // libro mayor en la misma transacción que lo crea. Sin esto, el día
        // que un número no cuadre, la primera carga sería justamente el
        // movimiento que no está.
        await ajustar(tx, {
          variantId: fila.id,
          nuevoTotal: input.stockTotal,
          actorUserId: ctx.session.profile.id,
          note: "Stock inicial de la variante",
        });

        return fila.id;
      });

      refrescar();
      return { id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

// ── Edición ─────────────────────────────────────────────────────────────

export const editarUnaVariante = action
  .input(editarVariante)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    // Sólo el producto: el stock ya no se lee acá. Ver el comentario de abajo.
    const [actual] = await db.execute<{ productId: string }>(sql`
      SELECT product_id AS "productId"
        FROM product_variants WHERE id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    await verificarColor(actual.productId, input.colorId, input.isActive);

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(productVariants)
          .set({
            colorId: input.colorId,
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, input.id));

        /**
         * El stock lo mueve `ajustar()` y nadie más (F4.1). Además del
         * asiento, se lleva puesta una carrera que este código tenía: el
         * stock reservado se leía FUERA de la transacción, así que entre esa
         * lectura y el UPDATE otra orden podía reservar unidades y el «no
         * puede bajar de N» se decidía contra un N viejo. Cuando eso pasaba,
         * el que rechazaba era el CHECK `reserved_within_total` —con un error
         * de integridad, que sale como INTERNAL y llega a Sentry como si
         * fuera un incidente en vez de como lo que es: un resultado del
         * negocio con una frase que lo explica—. `ajustar()` bloquea la fila
         * y decide contra el número de verdad.
         */
        await ajustar(tx, {
          variantId: input.id,
          nuevoTotal: input.stockTotal,
          actorUserId: ctx.session.profile.id,
          note: "Ajuste manual desde el panel",
        });
      });

      refrescar();
      return { id: input.id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

// ── Baja (RF-16, RN-11) ─────────────────────────────────────────────────

export const eliminarUnaVariante = action
  .input(soloVariante)
  .auth("admin")
  .handler(async ({ input }) => {
    const [actual] = await db.execute<{
      reservedStock: number;
      ordenes: number;
    }>(sql`
      SELECT v.reserved_stock AS "reservedStock",
             (SELECT count(DISTINCT oi.order_id) FROM order_items oi
               WHERE oi.variant_id = v.id)::int AS ordenes
        FROM product_variants v WHERE v.id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    // RF-16: no se puede quitar una variante con stock reservado, y hay que
    // decir QUÉ ÓRDENES la usan. Un «no se puede» sin el dónde deja a la
    // vendedora buscando a mano entre las órdenes activas.
    if (actual.reservedStock > 0) {
      const numeros = await db.execute<{ orderNumber: number }>(sql`
        SELECT DISTINCT o.order_number AS "orderNumber"
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE oi.variant_id = ${input.id} AND o.status = 'activa'
         ORDER BY 1`);

      const lista = numeros.map((o) => `#${o.orderNumber}`).join(", ");

      throw domainError("VARIANT_HAS_RESERVATIONS", {
        message: lista
          ? `Ese color tiene ${actual.reservedStock} ${actual.reservedStock === 1 ? "unidad reservada" : "unidades reservadas"} en ${numeros.length === 1 ? "la orden" : "las órdenes"} ${lista}. Resolvelas antes de sacarlo.`
          : undefined,
        ordenes: numeros.map((o) => o.orderNumber),
      });
    }

    // RN-11, el mismo final doble que «eliminar» un producto: una orden
    // histórica que la nombra la sigue mostrando, así que se desactiva.
    if (actual.ordenes > 0) {
      await db
        .update(productVariants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productVariants.id, input.id));

      refrescar();
      return {
        id: input.id,
        resultado: "desactivado" as const,
        ordenes: actual.ordenes,
      };
    }

    // Las claves se leen ANTES del DELETE: `variant_images` cae por cascada y
    // con ella la única referencia a los archivos (RF-17).
    const archivos = await clavesDeVariante(input.id);

    const filas = await db
      .delete(productVariants)
      .where(eq(productVariants.id, input.id))
      .returning({ id: productVariants.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE y sin poder fallar hacia afuera: la variante ya no
    // existe, y un archivo que sobreviva es basura, no un motivo para decirle
    // a la vendedora que no se pudo borrar algo que sí se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id: input.id, resultado: "borrado" as const, ordenes: 0 };
  });

// ── Reutilizar las imágenes de otra variante (RF-16, §9.5) ──────────────

export const reutilizarImagenes = action
  .input(fuenteDeImagenes)
  .auth("admin")
  .handler(async ({ input }) => {
    const [actual] = await db.execute<{
      productId: string;
      propias: number;
      prestadaA: number;
    }>(sql`
      SELECT v.product_id AS "productId",
             (SELECT count(*) FROM variant_images i
               WHERE i.variant_id = v.id)::int AS propias,
             (SELECT count(*) FROM product_variants o
               WHERE o.images_source_id = v.id)::int AS "prestadaA"
        FROM product_variants v WHERE v.id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    if (input.sourceId) {
      if (input.sourceId === input.id) {
        throw domainError("VALIDATION", {
          message: "Una variante no puede reutilizar sus propias imágenes.",
        });
      }

      const [fuente] = await db.execute<{
        productId: string;
        imagesSourceId: string | null;
      }>(sql`
        SELECT product_id AS "productId", images_source_id AS "imagesSourceId"
          FROM product_variants WHERE id = ${input.sourceId}`);

      if (!fuente) throw domainError("NOT_FOUND");

      if (fuente.productId !== actual.productId) {
        throw domainError("VALIDATION", {
          message:
            "Solo se pueden reutilizar las imágenes de otra variante del mismo producto.",
        });
      }

      // §9.5: UN SOLO SALTO. Con cadenas, resolver las imágenes de la ficha
      // dejaría de ser un `LEFT JOIN` y pasaría a ser un recorrido con un
      // ciclo posible: A reutiliza de B, B de C, C de A, y la consulta que
      // pinta la galería no termina nunca.
      if (fuente.imagesSourceId) {
        throw domainError("VALIDATION", {
          message:
            "Esa variante ya está reutilizando las imágenes de otra. Elegí la que las tiene de verdad.",
        });
      }

      if (actual.prestadaA > 0) {
        throw domainError("VALIDATION", {
          message: `Hay ${actual.prestadaA === 1 ? "otra variante que reutiliza" : `${actual.prestadaA} variantes que reutilizan`} las imágenes de esta, así que no puede reutilizar las de otra. Cambialas primero.`,
        });
      }

      /**
       * Reutilizar exige NO TENER PROPIAS, y no es un capricho: §9.5 dice que
       * la variante con fuente muestra las de la fuente, así que las propias
       * quedarían pagando lugar en Storage sin verse en ninguna pantalla.
       * Basura invisible es la peor clase de basura. Se piden borradas
       * primero, que además es una decisión explícita de quien la toma.
       */
      if (actual.propias > 0) {
        throw domainError("VALIDATION", {
          message: `Esta variante tiene ${actual.propias === 1 ? "una imagen propia" : `${actual.propias} imágenes propias`}. Borrá${actual.propias === 1 ? "la" : "las"} para poder reutilizar las de otra.`,
        });
      }
    }

    await db
      .update(productVariants)
      .set({ imagesSourceId: input.sourceId, updatedAt: new Date() })
      .where(eq(productVariants.id, input.id));

    refrescar();
    return { id: input.id, sourceId: input.sourceId };
  });

// ── Imágenes: orden, principal y baja (RF-17) ───────────────────────────

/**
 * Reordenar por arrastre y ELEGIR LA PRINCIPAL son la misma operación: la
 * principal es la que queda en la posición 0. Por eso hay una sola acción y
 * no dos — con una bandera aparte habría dos respuestas para la misma
 * pregunta y un estado imposible que igual habría que programar.
 */
export const ordenarImagenes = action
  .input(ordenDeImagenes)
  .auth("admin")
  .handler(async ({ input }) => {
    await reordenarImagenesDeVariante(input.variantId, input.ids);
    refrescar();
    return { variantId: input.variantId };
  });

export const borrarUnaImagen = action
  .input(soloImagen)
  .auth("admin")
  .handler(async ({ input }) => {
    await borrarImagenDeVariante(input.id);
    refrescar();
    return { id: input.id };
  });
