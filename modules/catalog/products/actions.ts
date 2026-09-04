"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { products } from "@/db/schema/catalog";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { slugificar } from "@/lib/slug";
import { borrarArchivos, clavesDeProducto } from "@/modules/media/subir";
import {
  cambioDeDestacadoDeProducto,
  cambioDeEstadoDeProducto,
  crearProducto,
  editarProducto,
  soloProducto,
} from "@/modules/catalog/products/schemas";

/**
 * ABM de productos — RF-15, RN-04b, RN-11b.
 *
 * Tres reglas que no están en el formulario y que por eso viven acá:
 *
 *   · **RN-11b al revés.** No se puede ACTIVAR un producto cuya marca o
 *     categoría estén inactivas, ni uno con variantes activas de un color
 *     inactivo. El otro sentido —no desactivar una marca con productos
 *     activos— ya lo cubre `modules/catalog/actions.ts`; juntos mantienen la
 *     invariante que le permite a `products.is_active` ser la única verdad
 *     sobre la visibilidad, y a las consultas públicas (§10.1) no tener que
 *     mirar el estado de la marca en cada `WHERE`.
 *   · **El slug no cambia al renombrar.** Es la dirección pública del
 *     producto (RF-03): corregir un nombre es frecuente, romper un enlace ya
 *     compartido por WhatsApp es irreversible.
 *   · **Borrar puede terminar en desactivar** (RF-15, RN-11): un producto que
 *     alguna orden nombra no se borra, porque la orden histórica lo sigue
 *     mostrando. Se desactiva, y se informa que eso fue lo que pasó.
 */

function refrescar() {
  revalidatePath("/admin/productos", "layout");
}

/** Igual que en RF-18: Postgres devuelve 23505 y Drizzle envuelve el error. */
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
 * Dos productos pueden llamarse igual —«Cable HDMI» de dos marcas—, así que
 * lo único único es el slug, y colisiona en silencio: la vendedora escribió
 * un nombre, no una dirección. El mensaje habla del nombre, que es lo que
 * ella ve, y sugiere qué agregarle.
 */
function siEsDuplicado(e: unknown): never {
  if (esDuplicado(e)) {
    throw domainError("VALIDATION", {
      message: "Ya hay un producto con ese nombre.",
      fields: {
        properties: {
          name: {
            errors: [
              "Ya hay un producto con ese nombre. Agregale el modelo o la marca para distinguirlos.",
            ],
          },
        },
      },
    });
  }
  throw e;
}

/**
 * RN-11b, el sentido que le toca a esta pantalla. Se consulta con los IDs que
 * se van a guardar y no con los que están guardados: al editar, la marca
 * puede estar cambiando en la misma operación.
 */
async function verificarRN11b(
  brandId: string,
  categoryId: string,
  activo: boolean,
) {
  if (!activo) return;

  const [fila] = await db.execute<{ marca: boolean; categoria: boolean }>(sql`
    SELECT (SELECT NOT is_active FROM brands     WHERE id = ${brandId})    AS marca,
           (SELECT NOT is_active FROM categories WHERE id = ${categoryId}) AS categoria
  `);

  // `null` = no existe. La clave foránea lo rechazaría igual, pero con un
  // error de integridad en vez de una frase.
  if (fila?.marca === null || fila?.categoria === null) {
    throw domainError("NOT_FOUND", {
      message: "La marca o la categoría que elegiste ya no existen. Actualizá la página.",
    });
  }

  if (fila.marca || fila.categoria) {
    const que = fila.marca && fila.categoria
      ? "La marca y la categoría están"
      : fila.marca
        ? "La marca está"
        : "La categoría está";
    throw domainError("ENTITY_IN_USE", {
      message: `${que} inactiva, así que el producto no puede estar activo. Activala primero, o guardá el producto como inactivo.`,
    });
  }
}

/**
 * RN-11b, el pedazo que faltaba: «ningún producto activo puede … tener
 * variantes activas de un color inactivo».
 *
 * No estaba en F2.3 porque no había variantes que mirar. Va aparte de
 * `verificarRN11b` y no adentro porque necesita el id del producto, que al
 * crear todavía no existe — y un producto recién creado no tiene variantes,
 * así que ahí no hay nada que comprobar.
 */
async function verificarColoresDeVariantes(productId: string, activo: boolean) {
  if (!activo) return;

  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM product_variants v
      JOIN colors c ON c.id = v.color_id
     WHERE v.product_id = ${productId} AND v.is_active AND NOT c.is_active`);

  if ((fila?.n ?? 0) > 0) {
    throw domainError("ENTITY_IN_USE", {
      message: `${fila.n === 1 ? "Hay un color inactivo" : `Hay ${fila.n} colores inactivos`} en las variantes activas de este producto, así que no puede estar activo. Activá ${fila.n === 1 ? "ese color" : "esos colores"}, o desactivá esas variantes.`,
    });
  }
}

// ── Alta ────────────────────────────────────────────────────────────────

export const crearUnProducto = action
  .input(crearProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    await verificarRN11b(input.brandId, input.categoryId, input.isActive);

    try {
      const [fila] = await db
        .insert(products)
        .values({ ...input, slug: slugificar(input.name) })
        .returning({ id: products.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

// ── Edición ─────────────────────────────────────────────────────────────

export const editarUnProducto = action
  .input(editarProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    const { id, ...campos } = input;
    await verificarRN11b(campos.brandId, campos.categoryId, campos.isActive);
    await verificarColoresDeVariantes(id, campos.isActive);

    try {
      // El SLUG NO SE TOCA: no está en el `set`, a propósito.
      const filas = await db
        .update(products)
        .set({ ...campos, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning({ id: products.id });

      if (!filas.length) throw domainError("NOT_FOUND");
      refrescar();
      return { id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

// ── Activar y desactivar ────────────────────────────────────────────────

export const cambiarEstadoDeProducto = action
  .input(cambioDeEstadoDeProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    const [actual] = await db.execute<{ brandId: string; categoryId: string }>(sql`
      SELECT brand_id AS "brandId", category_id AS "categoryId"
        FROM products WHERE id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    await verificarRN11b(actual.brandId, actual.categoryId, input.activo);
    await verificarColoresDeVariantes(input.id, input.activo);

    await db
      .update(products)
      .set({ isActive: input.activo, updatedAt: new Date() })
      .where(eq(products.id, input.id));

    refrescar();
    return { id: input.id, activo: input.activo };
  });

// ── Destacar ────────────────────────────────────────────────────────────
//
// Destacar NO PUBLICA (RF-15), igual que en las categorías: `is_active` sigue
// siendo la única verdad sobre la visibilidad. Por eso destacar un producto
// inactivo no se rechaza — es una preferencia guardada para cuando se active.

export const cambiarDestacadoDeProducto = action
  .input(cambioDeDestacadoDeProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(products)
      .set({ isFeatured: input.destacado, updatedAt: new Date() })
      .where(eq(products.id, input.id))
      .returning({ id: products.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id, destacado: input.destacado };
  });

// ── Baja (RF-15, RN-11) ─────────────────────────────────────────────────

export const eliminarUnProducto = action
  .input(soloProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    /**
     * ¿Alguna orden lo nombra? Se pregunta por las VARIANTES, que es lo que
     * `order_items` referencia.
     *
     * La base no lo impediría: la clave es `ON DELETE SET NULL` justamente
     * para que el snapshot de la orden (§5.6) sobreviva a un producto
     * borrado. Pero una orden con la variante en NULL pierde el enlace al
     * producto para siempre, y RF-15 pide conservarlo: se desactiva.
     */
    const [uso] = await db.execute<{ ordenes: number }>(sql`
      SELECT count(DISTINCT oi.order_id)::int AS ordenes
        FROM order_items oi
        JOIN product_variants v ON v.id = oi.variant_id
       WHERE v.product_id = ${input.id}`);

    if ((uso?.ordenes ?? 0) > 0) {
      const filas = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning({ id: products.id });

      if (!filas.length) throw domainError("NOT_FOUND");

      refrescar();
      // No es un error: es el otro final posible de «eliminar». La vista
      // cuenta qué pasó, en vez de decir «listo» sobre algo que sigue ahí.
      return { id: input.id, resultado: "desactivado" as const, ordenes: uso.ordenes };
    }

    // Las claves de TODAS las imágenes de TODAS sus variantes, leídas ANTES
    // del DELETE: el borrado cae en cascada hasta `variant_images` y se lleva
    // con él la única referencia a los archivos. Después ya no hay dónde
    // buscarlas, y quedan en Storage para siempre sin que se note en ninguna
    // pantalla (RF-17). Es lo mismo que hace `eliminar` con el logo de marca.
    const archivos = await clavesDeProducto(input.id);

    const filas = await db
      .delete(products)
      .where(eq(products.id, input.id))
      .returning({ id: products.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE y sin poder fallar hacia afuera: el producto ya no
    // existe. Un archivo que sobreviva es basura, no un motivo para decir que
    // no se pudo borrar algo que sí se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id: input.id, resultado: "borrado" as const, ordenes: 0 };
  });
