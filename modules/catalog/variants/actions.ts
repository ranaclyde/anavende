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
import { variantesParaReponer } from "@/modules/catalog/variants/queries";
import {
  crearVariante,
  editarVariante,
  fuenteDeImagenes,
  ordenDeImagenes,
  reposicion,
  soloImagen,
  soloProducto,
  soloVariante,
} from "@/modules/catalog/variants/schemas";

// El stock se cambia solo con `ajustar()` de `modules/stock`, que asienta el
// movimiento (TECHNICAL-SPEC §8.3): acá no se escribe `stock_total`.

function refrescar() {
  revalidatePath("/admin/productos", "layout");
}

/** Drizzle envuelve el 23505 de Postgres: hay que recorrer la cadena de `cause`. */
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

/** El índice único es la combinación de colores sin orden, por producto. */
function siEsDuplicado(e: unknown): never {
  if (esDuplicado(e)) {
    throw domainError("VALIDATION", {
      message:
        "Ese color, o esa combinación de colores, ya está cargado en este producto. Editá el que ya está en vez de agregarlo de nuevo.",
    });
  }
  throw e;
}

/** RN-11b, con el color que se va a guardar: al editar puede estar cambiando. */
async function verificarColor(
  productId: string,
  colorId: string | null,
  secondaryColorId: string | null,
  varianteActiva: boolean,
) {
  if (!colorId || !varianteActiva) return;

  const [fila] = await db.execute<{
    productoActivo: boolean;
    colorActivo: boolean | null;
    segundoActivo: boolean | null;
  }>(sql`
    SELECT p.is_active AS "productoActivo",
           (SELECT is_active FROM colors WHERE id = ${colorId}) AS "colorActivo",
           (SELECT is_active FROM colors
             WHERE id = ${secondaryColorId}) AS "segundoActivo"
      FROM products p
     WHERE p.id = ${productId}`);

  if (!fila) throw domainError("NOT_FOUND");

  // `null` = el color no existe.
  if (
    fila.colorActivo === null ||
    (secondaryColorId && fila.segundoActivo === null)
  ) {
    throw domainError("NOT_FOUND", {
      message: "El color que elegiste ya no existe. Actualizá la página.",
    });
  }

  if (
    fila.productoActivo &&
    (!fila.colorActivo || (secondaryColorId && !fila.segundoActivo))
  ) {
    throw domainError("ENTITY_IN_USE", {
      message:
        "Ese color está inactivo en el catálogo, así que no puede ofrecerse en un producto activo. Activalo en «Colores», o guardalo en este producto como inactivo.",
    });
  }
}

export const agregarUnaVariante = action
  .input(crearVariante)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    await verificarColor(
      input.productId,
      input.colorId,
      input.secondaryColorId,
      input.isActive,
    );

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
            secondaryColorId: input.secondaryColorId,
            // Nace en cero: el stock entra abajo, como movimiento.
            isActive: input.isActive,
            sortOrder: n,
          })
          .returning({ id: productVariants.id });

        await ajustar(tx, {
          variantId: fila.id,
          nuevoTotal: input.stockTotal,
          actorUserId: ctx.session.profile.id,
          note: "Stock inicial al agregar el color",
        });

        return fila.id;
      });

      refrescar();
      return { id };
    } catch (e) {
      siEsDuplicado(e);
    }
  });

export const editarUnaVariante = action
  .input(editarVariante)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    // El stock no se lee acá: lo decide `ajustar()` con la fila bloqueada.
    const [actual] = await db.execute<{ productId: string }>(sql`
      SELECT product_id AS "productId"
        FROM product_variants WHERE id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    await verificarColor(
      actual.productId,
      input.colorId,
      input.secondaryColorId,
      input.isActive,
    );

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(productVariants)
          .set({
            colorId: input.colorId,
            secondaryColorId: input.secondaryColorId,
            isActive: input.isActive,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, input.id));

        // No leer el reservado afuera de la transacción: otra orden puede
        // reservar en el medio y el CHECK saltaría como INTERNAL.
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

/** Una lectura por acción, para que la guarde el mismo envoltorio `admin`. */
export const leerParaReponer = action
  .input(soloProducto)
  .auth("admin")
  .handler(async ({ input }) => ({
    variantes: await variantesParaReponer(input.productId),
  }));

/** Una sola transacción: o entran todos los colores o ninguno. */
export const reponerStock = action
  .input(reposicion)
  .auth("admin")
  .handler(async ({ input, ctx }) => {
    const suyas = await db.execute<{ id: string }>(sql`
      SELECT id FROM product_variants WHERE product_id = ${input.productId}`);
    const permitidas = new Set(suyas.map((v) => v.id));

    // Sin esto, una petición armada a mano movería el stock de otro producto.
    for (const ajuste of input.ajustes) {
      if (!permitidas.has(ajuste.variantId)) throw domainError("NOT_FOUND");
    }

    await db.transaction(async (tx) => {
      for (const ajuste of input.ajustes) {
        await ajustar(tx, {
          variantId: ajuste.variantId,
          nuevoTotal: ajuste.nuevoTotal,
          actorUserId: ctx.session.profile.id,
          note: "Reposición desde el listado",
        });
      }
    });

    refrescar();
    return { cuantos: input.ajustes.length };
  });

export const eliminarUnaVariante = action
  .input(soloVariante)
  .auth("admin")
  .handler(async ({ input }) => {
    const [actual] = await db.execute<{
      reservedStock: number;
      ordenes: number;
      carritos: number;
    }>(sql`
      SELECT v.reserved_stock AS "reservedStock",
             (SELECT count(DISTINCT oi.order_id) FROM order_items oi
               WHERE oi.variant_id = v.id)::int AS ordenes,
             (SELECT count(*) FROM cart_items ci
               WHERE ci.variant_id = v.id)::int AS carritos
        FROM product_variants v WHERE v.id = ${input.id}`);

    if (!actual) throw domainError("NOT_FOUND");

    // Con stock reservado no se quita, y se dice qué órdenes la usan (RF-16).
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

    // Con órdenes o carritos se desactiva en vez de borrar (RN-11).
    if (actual.ordenes > 0 || actual.carritos > 0) {
      await db
        .update(productVariants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productVariants.id, input.id));

      refrescar();
      return {
        id: input.id,
        resultado: "desactivado" as const,
        ordenes: actual.ordenes,
        carritos: actual.carritos,
      };
    }

    // Antes del DELETE: la cascada borra `variant_images`, la única referencia
    // a los archivos en Storage.
    const archivos = await clavesDeVariante(input.id);

    const filas = await db
      .delete(productVariants)
      .where(eq(productVariants.id, input.id))
      .returning({ id: productVariants.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE y sin fallar hacia afuera: la variante ya se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return {
      id: input.id,
      resultado: "borrado" as const,
      ordenes: 0,
      carritos: 0,
    };
  });

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
          message:
            "Un color no puede reutilizar sus propias fotos. Elegí otro.",
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
            "Solo se pueden reutilizar las fotos de otro color del mismo producto. Actualizá la página y elegí de nuevo.",
        });
      }

      // Un solo salto (TECHNICAL-SPEC §9.5): las consultas lo resuelven con un
      // `coalesce`, y una cadena podría cerrar un ciclo.
      if (fuente.imagesSourceId) {
        throw domainError("VALIDATION", {
          message:
            "Ese color ya usa las fotos de otro. Elegí el color que las tiene de verdad.",
        });
      }

      if (actual.prestadaA > 0) {
        throw domainError("VALIDATION", {
          message: `${actual.prestadaA === 1 ? "Otro color usa" : `${actual.prestadaA} colores usan`} las fotos de este, así que este no puede usar las de otro. Cambiá primero ${actual.prestadaA === 1 ? "ese color" : "esos colores"}.`,
        });
      }

      // Con fuente, las propias no se verían nunca y quedarían en Storage.
      if (actual.propias > 0) {
        throw domainError("VALIDATION", {
          message: `Este color tiene ${actual.propias === 1 ? "una foto propia" : `${actual.propias} fotos propias`}. Borrá${actual.propias === 1 ? "la" : "las"} para poder usar las de otro.`,
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

/** También elige la principal: es la que queda en la posición 0. */
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
