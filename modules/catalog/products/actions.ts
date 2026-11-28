"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { products } from "@/db/schema/catalog";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { borrarArchivos, clavesDeProducto } from "@/modules/media/subir";
import {
  cambioDeDestacadoDeProducto,
  cambioDeEstadoDeProducto,
  crearProducto,
  editarProducto,
  soloProducto,
} from "@/modules/catalog/products/schemas";

// RN-11b en este sentido (no activar un producto con marca, categoría o color
// inactivos) más el otro en `modules/catalog/actions.ts` sostienen que
// `products.is_active` sea la única verdad sobre la visibilidad: las consultas
// públicas no miran el estado de la marca ni de la categoría.

function refrescar() {
  revalidatePath("/admin/productos", "layout");
}

/**
 * Drizzle envuelve el 23505 de Postgres en `cause`. Devuelve el índice que
 * chocó, o `null` si no fue un duplicado.
 */
function indiceDuplicado(e: unknown): string | null {
  let actual: unknown = e;
  for (let i = 0; i < 5 && actual; i++) {
    if (
      typeof actual === "object" &&
      "code" in actual &&
      (actual as { code?: unknown }).code === "23505"
    ) {
      const indice = (actual as { constraint_name?: unknown }).constraint_name;
      return typeof indice === "string" ? indice : "";
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return null;
}

/** El slug sale del nombre, así que su choque se informa sobre el nombre. */
function siEsDuplicado(e: unknown): never {
  const indice = indiceDuplicado(e);
  // El SKU es único dentro de la marca.
  if (indice === "products_sku_key") {
    throw domainError("VALIDATION", {
      message: "Ya hay un producto de esa marca con ese SKU.",
      fields: {
        properties: {
          sku: { errors: ["Ya hay un producto de esa marca con ese SKU."] },
        },
      },
    });
  }
  if (indice !== null) {
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

/** Con los ids que se van a guardar: al editar, la marca puede estar cambiando. */
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

  // `null` = no existe.
  if (fila?.marca === null || fila?.categoria === null) {
    throw domainError("NOT_FOUND", {
      message:
        "La marca o la categoría que elegiste ya no existen. Actualizá la página.",
    });
  }

  if (fila.marca || fila.categoria) {
    const que =
      fila.marca && fila.categoria
        ? "La marca y la categoría están"
        : fila.marca
          ? "La marca está"
          : "La categoría está";
    throw domainError("ENTITY_IN_USE", {
      message: `${que} inactiva, así que el producto no puede estar activo. Activala primero, o guardá el producto como inactivo.`,
    });
  }
}

/** RN-11b para colores. Al crear no hace falta: todavía no hay variantes. */
async function verificarColoresDeVariantes(productId: string, activo: boolean) {
  if (!activo) return;

  const [fila] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n
      FROM product_variants v
      JOIN variant_colors c ON c.variant_id = v.id
     WHERE v.product_id = ${productId} AND v.is_active AND NOT c.is_active`);

  if ((fila?.n ?? 0) > 0) {
    throw domainError("ENTITY_IN_USE", {
      message: `${fila.n === 1 ? "Hay un color inactivo" : `Hay ${fila.n} colores inactivos`} en las variantes activas de este producto, así que no puede estar activo. Activá ${fila.n === 1 ? "ese color" : "esos colores"}, o desactivá esas variantes.`,
    });
  }
}

export const crearUnProducto = action
  .input(crearProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    await verificarRN11b(input.brandId, input.categoryId, input.isActive);

    try {
      const [fila] = await db
        .insert(products)
        .values({ ...input, slug: slugify(input.name) })
        .returning({ id: products.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

export const editarUnProducto = action
  .input(editarProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    const { id, ...campos } = input;
    await verificarRN11b(campos.brandId, campos.categoryId, campos.isActive);
    await verificarColoresDeVariantes(id, campos.isActive);

    try {
      // El slug no se toca a propósito: rompería enlaces ya compartidos.
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

export const cambiarEstadoDeProducto = action
  .input(cambioDeEstadoDeProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    const [actual] = await db.execute<{
      brandId: string;
      categoryId: string;
    }>(sql`
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

// Destacar no publica (RF-15): destacar un producto inactivo no se rechaza.

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

export const eliminarUnProducto = action
  .input(soloProducto)
  .auth("admin")
  .handler(async ({ input }) => {
    // Con órdenes o carritos se desactiva en vez de borrar (RN-11). La base no
    // lo impediría: `order_items` es `ON DELETE SET NULL` y `cart_items` cae
    // en cascada, y en los dos casos se pierde el enlace al producto.
    const [uso] = await db.execute<{ ordenes: number; carritos: number }>(sql`
      SELECT (SELECT count(DISTINCT oi.order_id)
                FROM order_items oi
                JOIN product_variants v ON v.id = oi.variant_id
               WHERE v.product_id = ${input.id})::int AS ordenes,
             (SELECT count(DISTINCT ci.cart_id)
                FROM cart_items ci
                JOIN product_variants v ON v.id = ci.variant_id
               WHERE v.product_id = ${input.id})::int AS carritos`);

    if (uso.ordenes > 0 || uso.carritos > 0) {
      const filas = await db
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, input.id))
        .returning({ id: products.id });

      if (!filas.length) throw domainError("NOT_FOUND");

      refrescar();
      // No es un error: la vista cuenta que se desactivó.
      return {
        id: input.id,
        resultado: "desactivado" as const,
        ordenes: uso.ordenes,
        carritos: uso.carritos,
      };
    }

    // Antes del DELETE: la cascada borra `variant_images`, la única referencia
    // a los archivos en Storage.
    const archivos = await clavesDeProducto(input.id);

    const filas = await db
      .delete(products)
      .where(eq(products.id, input.id))
      .returning({ id: products.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE y sin fallar hacia afuera: el producto ya se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return {
      id: input.id,
      resultado: "borrado" as const,
      ordenes: 0,
      carritos: 0,
    };
  });
