"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { brands, categories, colors } from "@/db/schema/catalog";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { slugificar } from "@/lib/slug";
import {
  borrarArchivos,
  clavesDelLogo,
  quitarLogoDeMarca,
} from "@/modules/media/subir";
import {
  cambioDeDestacada,
  cambioDeEstado,
  soloId,
  crearCategoria,
  crearColor,
  crearMarca,
  editarCategoria,
  editarColor,
  editarMarca,
  referencia,
  type TipoDeItem,
} from "@/modules/catalog/schemas";

/**
 * ABM de marcas, categorías y colores — RF-18, RN-11, RN-11b.
 *
 * Las tres entidades comparten las mismas dos reglas, y por eso comparten
 * código:
 *
 *   · **Borrar** exige que NADIE la use (RN-11). La clave foránea es
 *     `ON DELETE RESTRICT`, así que la base lo impediría igual; se verifica
 *     antes para poder decir cuántos productos son y ofrecer desactivar, en
 *     vez de devolver un error de integridad.
 *   · **Desactivar** exige que no quede ningún producto ACTIVO usándola
 *     (RN-11b). Es la invariante que permite que `products.is_active` sea la
 *     única verdad sobre la visibilidad de un producto, y que las consultas
 *     públicas (§10.1, §11.2) no tengan que mirar el estado de la marca.
 *
 * Activar, en cambio, nunca se rechaza: una marca activa con productos
 * inactivos no rompe nada.
 */

const TABLAS = { marca: brands, categoria: categories, color: colors } as const;

/**
 * Concordancia: «color» es masculino y las otras dos femeninas. Sin el
 * pronombre, los mensajes terminan diciendo «el color… que la usa».
 */
const NOMBRES: Record<
  TipoDeItem,
  { singular: string; el: string; lo: string }
> = {
  marca: { singular: "marca", el: "la marca", lo: "la" },
  categoria: { singular: "categoría", el: "la categoría", lo: "la" },
  color: { singular: "color", el: "el color", lo: "lo" },
};

/** Cuenta los productos que usan el ítem, separando activos de inactivos. */
async function contarUso(tipo: TipoDeItem, id: string) {
  const condicion =
    tipo === "marca"
      ? sql`SELECT is_active FROM products WHERE brand_id = ${id}`
      : tipo === "categoria"
        ? sql`SELECT is_active FROM products WHERE category_id = ${id}`
        : // Un producto por fila, y «activo» significa lo que dice RN-11b:
          // que tenga una variante ACTIVA de este color, estando él activo.
          // Contarlo sin mirar `v.is_active` bloquearía desactivar un color
          // que ya nadie muestra —su variante está apagada— sin ninguna
          // forma de saber por qué desde la pantalla.
          sql`SELECT bool_or(v.is_active AND p.is_active) AS is_active
                FROM product_variants v
                JOIN products p ON p.id = v.product_id
               WHERE v.color_id = ${id}
               GROUP BY p.id`;

  const [fila] = await db.execute<{ activos: number; total: number }>(sql`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (${condicion}) AS usos
  `);

  return fila ?? { activos: 0, total: 0 };
}

/**
 * Postgres devuelve 23505 al violar un índice único. Drizzle envuelve el
 * error, así que hay que recorrer la cadena de causas: mirar solo el error de
 * arriba no encuentra nada.
 */
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

/** Convierte la colisión de índice único en el mensaje que la vendedora lee. */
function siEsDuplicado(e: unknown, tipo: TipoDeItem): never {
  if (esDuplicado(e)) {
    throw domainError("VALIDATION", {
      message: `Ya existe ${tipo === "color" ? "un" : "una"} ${NOMBRES[tipo].singular} con ese nombre.`,
      // El envoltorio cuelga los mensajes de cada campo desde `fields`
      // (§6.2, paso 3); acá se arma la misma forma a mano para que el error
      // aparezca debajo del campo y no como un cartel suelto.
      fields: { properties: { name: { errors: ["Ese nombre ya está usado."] } } },
    });
  }
  throw e;
}

function refrescar() {
  revalidatePath("/admin/catalogo", "layout");
}

// ── Alta ────────────────────────────────────────────────────────────────

export const crearUnaMarca = action
  .input(crearMarca)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const [fila] = await db
        .insert(brands)
        .values({ name: input.name, slug: slugificar(input.name) })
        .returning({ id: brands.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e, "marca");
    }
  });

export const crearUnaCategoria = action
  .input(crearCategoria)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const [fila] = await db
        .insert(categories)
        .values({
          name: input.name,
          slug: slugificar(input.name),
          isFeatured: input.isFeatured,
        })
        .returning({ id: categories.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e, "categoria");
    }
  });

export const crearUnColor = action
  .input(crearColor)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const [fila] = await db
        .insert(colors)
        .values({
          name: input.name,
          slug: slugificar(input.name),
          hexCode: input.hexCode,
        })
        .returning({ id: colors.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e, "color");
    }
  });

// ── Edición ─────────────────────────────────────────────────────────────
//
// El SLUG NO SE TOCA al renombrar. Es la dirección pública del ítem: si
// cambiara, todo enlace compartido por WhatsApp dejaría de funcionar sin
// aviso. Corregir un nombre es frecuente; romper enlaces, irreversible.

export const editarUnaMarca = action
  .input(editarMarca)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const filas = await db
        .update(brands)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(brands.id, input.id))
        .returning({ id: brands.id });
      if (!filas.length) throw domainError("NOT_FOUND");
      refrescar();
      return { id: input.id };
    } catch (e) {
      siEsDuplicado(e, "marca");
    }
  });

export const editarUnaCategoria = action
  .input(editarCategoria)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const filas = await db
        .update(categories)
        .set({
          name: input.name,
          isFeatured: input.isFeatured,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, input.id))
        .returning({ id: categories.id });
      if (!filas.length) throw domainError("NOT_FOUND");
      refrescar();
      return { id: input.id };
    } catch (e) {
      siEsDuplicado(e, "categoria");
    }
  });

export const editarUnColor = action
  .input(editarColor)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const filas = await db
        .update(colors)
        .set({ name: input.name, hexCode: input.hexCode })
        .where(eq(colors.id, input.id))
        .returning({ id: colors.id });
      if (!filas.length) throw domainError("NOT_FOUND");
      refrescar();
      return { id: input.id };
    } catch (e) {
      siEsDuplicado(e, "color");
    }
  });

// ── Activar y desactivar (RN-11b) ───────────────────────────────────────

export const cambiarEstado = action
  .input(cambioDeEstado)
  .auth("admin")
  .handler(async ({ input }) => {
    const { tipo, id, activo } = input;

    if (!activo) {
      const { activos } = await contarUso(tipo, id);
      if (activos > 0) {
        throw domainError("ENTITY_IN_USE", {
          message:
            activos === 1
              ? `No se puede desactivar ${NOMBRES[tipo].el}: hay 1 producto activo que ${NOMBRES[tipo].lo} usa. Desactivá ese producto primero.`
              : `No se puede desactivar ${NOMBRES[tipo].el}: hay ${activos} productos activos que ${NOMBRES[tipo].lo} usan. Desactivalos primero.`,
          activos,
        });
      }
    }

    const tabla = TABLAS[tipo];
    const filas = await db
      .update(tabla)
      .set({ isActive: activo })
      .where(eq(tabla.id, id))
      .returning({ id: tabla.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id, activo };
  });

// ── Destacar (RF-18) ────────────────────────────────────────────────────
//
// Destacar NO SE RECHAZA NUNCA, ni siquiera sobre una categoría inactiva:
// no publica nada. `is_active` sigue siendo la única verdad sobre la
// visibilidad —la misma invariante que sostiene RN-11b—, y destacar sólo
// decide el orden entre las que ya se ven. Una categoría inactiva y
// destacada es una preferencia guardada para cuando se reactive, no una
// contradicción que haya que impedir.
//
// Tampoco hay tope de destacadas: destacarlas todas equivale a no destacar
// ninguna, que es una consecuencia visible en el acto y reversible con un
// clic. Un límite en el servidor sería una regla que la vendedora choca sin
// haberla pedido.

export const cambiarDestacada = action
  .input(cambioDeDestacada)
  .auth("admin")
  .handler(async ({ input }) => {
    const filas = await db
      .update(categories)
      .set({ isFeatured: input.destacada, updatedAt: new Date() })
      .where(eq(categories.id, input.id))
      .returning({ id: categories.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    refrescar();
    return { id: input.id, destacada: input.destacada };
  });

// ── Logo de marca (RF-18) ───────────────────────────────────────────────
//
// SUBIRLO no pasa por acá: va por `POST /api/admin/upload`, porque una Server
// Action serializa su entrada y mandarle un archivo de 8 MB significa pasarlo
// a base64 (§9.1). QUITARLO sí, que es un booleano y no un binario.

export const quitarElLogo = action
  .input(soloId)
  .auth("admin")
  .handler(async ({ input }) => {
    await quitarLogoDeMarca(input.id);
    refrescar();
    return { id: input.id };
  });

// ── Baja (RN-11) ────────────────────────────────────────────────────────

export const eliminar = action
  .input(referencia)
  .auth("admin")
  .handler(async ({ input }) => {
    const { tipo, id } = input;
    const { total, activos } = await contarUso(tipo, id);

    if (total > 0) {
      throw domainError("ENTITY_IN_USE", {
        message:
          total === 1
            ? `No se puede borrar ${NOMBRES[tipo].el}: hay 1 producto que ${NOMBRES[tipo].lo} usa.`
            : `No se puede borrar ${NOMBRES[tipo].el}: hay ${total} productos que ${NOMBRES[tipo].lo} usan.`,
        total,
        // La vista ofrece desactivar en su lugar, pero solo tiene sentido
        // ofrecerlo si desactivar es posible: con productos activos, RN-11b
        // también lo rechazaría.
        activos,
      });
    }

    // Las claves del logo se leen ANTES del DELETE: después la fila ya no
    // está y se perdieron con ella. Es la única forma de que borrar una marca
    // no deje sus archivos dando vueltas en Storage (RF-18).
    const archivos = tipo === "marca" ? await clavesDelLogo(id) : [];

    const tabla = TABLAS[tipo];
    const filas = await db
      .delete(tabla)
      .where(eq(tabla.id, id))
      .returning({ id: tabla.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE, y sin poder fallar hacia afuera: la marca ya no
    // existe: un archivo que sobreviva es basura, no un motivo para decirle a
    // la vendedora que no se pudo borrar algo que sí se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id };
  });
