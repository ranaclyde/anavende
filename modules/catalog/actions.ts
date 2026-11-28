"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { brands, categories, colors } from "@/db/schema/catalog";
import { action } from "@/lib/action";
import { domainError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import {
  borrarArchivos,
  clavesDelLogo,
  quitarLogo,
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
import { guardarRelaciones } from "@/modules/catalog/relaciones";

// Desactivar exige que ningún producto activo use el ítem (RN-11b): eso deja
// a `products.is_active` como única verdad sobre la visibilidad, y las
// consultas públicas no miran el estado de la marca ni de la categoría.

const TABLAS = { marca: brands, categoria: categories, color: colors } as const;

const NOMBRES: Record<
  TipoDeItem,
  { singular: string; el: string; lo: string }
> = {
  marca: { singular: "marca", el: "la marca", lo: "la" },
  categoria: { singular: "categoría", el: "la categoría", lo: "la" },
  color: { singular: "color", el: "el color", lo: "lo" },
};

async function contarUso(tipo: TipoDeItem, id: string) {
  const condicion =
    tipo === "marca"
      ? sql`SELECT is_active FROM products WHERE brand_id = ${id}`
      : tipo === "categoria"
        ? sql`SELECT is_active FROM products WHERE category_id = ${id}`
        : // Activo = una variante activa de este color (primero o segundo)
          // en un producto activo (RN-11b).
          sql`SELECT bool_or(v.is_active AND p.is_active) AS is_active
                FROM product_variants v
                JOIN products p ON p.id = v.product_id
               WHERE ${id} IN (v.color_id, v.secondary_color_id)
               GROUP BY p.id`;

  const [fila] = await db.execute<{ activos: number; total: number }>(sql`
    SELECT count(*) FILTER (WHERE is_active)::int AS activos,
           count(*)::int AS total
      FROM (${condicion}) AS usos
  `);

  return fila ?? { activos: 0, total: 0 };
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

function siEsDuplicado(e: unknown, tipo: TipoDeItem): never {
  if (esDuplicado(e)) {
    throw domainError("VALIDATION", {
      message: `Ya existe ${tipo === "color" ? "un" : "una"} ${NOMBRES[tipo].singular} con ese nombre.`,
      // La misma forma que arma el envoltorio, para que salga bajo el campo.
      fields: {
        properties: { name: { errors: ["Ese nombre ya está usado."] } },
      },
    });
  }
  throw e;
}

function refrescar() {
  revalidatePath("/admin/catalogo", "layout");
}

export const crearUnaMarca = action
  .input(crearMarca)
  .auth("admin")
  .handler(async ({ input }) => {
    try {
      const [fila] = await db
        .insert(brands)
        .values({ name: input.name, slug: slugify(input.name) })
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
      const id = await db.transaction(async (tx) => {
        const [fila] = await tx
          .insert(categories)
          .values({
            name: input.name,
            slug: slugify(input.name),
            isFeatured: input.isFeatured,
            description: input.description ?? null,
          })
          .returning({ id: categories.id });
        if (input.relacionadas) {
          await guardarRelaciones(tx, fila.id, input.relacionadas);
        }
        return fila.id;
      });
      refrescar();
      return { id };
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
          slug: slugify(input.name),
          hexCode: input.hexCode,
        })
        .returning({ id: colors.id });
      refrescar();
      return { id: fila.id };
    } catch (e) {
      siEsDuplicado(e, "color");
    }
  });

// El slug no se toca al renombrar: rompería enlaces ya compartidos.

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
      await db.transaction(async (tx) => {
        const filas = await tx
          .update(categories)
          .set({
            name: input.name,
            isFeatured: input.isFeatured,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(categories.id, input.id))
          .returning({ id: categories.id });
        if (!filas.length) throw domainError("NOT_FOUND");
        if (input.relacionadas) {
          await guardarRelaciones(tx, input.id, input.relacionadas);
        }
      });
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

// Destacar no se rechaza nunca, ni sobre una inactiva: no publica nada. Sin
// tope a propósito.

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

// Subir el logo va por `POST /api/admin/upload`: una Server Action pasaría el
// archivo a base64 (TECHNICAL-SPEC §9.1). Quitarlo sí va acá.

export const quitarElLogo = action
  .input(soloId)
  .auth("admin")
  .handler(async ({ input }) => {
    await quitarLogo("marca", input.id);
    refrescar();
    return { id: input.id };
  });

export const quitarLaImagenDeCategoria = action
  .input(soloId)
  .auth("admin")
  .handler(async ({ input }) => {
    await quitarLogo("categoria", input.id);
    refrescar();
    return { id: input.id };
  });

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
        // La vista ofrece desactivar solo si no hay activos (RN-11b).
        activos,
      });
    }

    // Antes del DELETE: la fila es la única referencia a los archivos.
    const archivos = tipo === "color" ? [] : await clavesDelLogo(tipo, id);

    const tabla = TABLAS[tipo];
    const filas = await db
      .delete(tabla)
      .where(eq(tabla.id, id))
      .returning({ id: tabla.id });

    if (!filas.length) throw domainError("NOT_FOUND");

    // Después del DELETE y sin fallar hacia afuera: el ítem ya se borró.
    if (archivos.length) await borrarArchivos(archivos);

    refrescar();
    return { id };
  });
