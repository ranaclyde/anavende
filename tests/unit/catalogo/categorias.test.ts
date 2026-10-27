import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  enlaceDeWhatsApp,
  mensajeDeBusquedaSinResultados,
  mensajeDeConsultaGeneral,
} from "@/lib/whatsapp";
import { normalizar } from "@/lib/texto";
import {
  cantidadDeProductos,
  repartirCategorias,
  type CategoriaDeLaPagina,
} from "@/modules/catalog/products/categorias";
import { leerCategoriasDeLaTienda } from "@/modules/catalog/products/categorias-de-la-tienda";
import { limpiar, unProducto } from "@/tests/apoyo/catalogo";

/** Página de categorías — RF-35, DR §7.6. Tarea F3.10. */

const sueltas = { productos: [] as string[], categorias: [] as string[] };

afterAll(async () => {
  for (const id of sueltas.productos.splice(0)) {
    await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
  }
  await limpiar();
  for (const id of sueltas.categorias.splice(0)) {
    await db.execute(sql`DELETE FROM categories WHERE id = ${id}`);
  }
});

async function unaCategoria(
  activa: boolean,
): Promise<{ id: string; nombre: string }> {
  const sufijo = randomUUID().slice(0, 8);
  const nombre = `Vacía ${sufijo}`;
  const [fila] = await db.execute<{ id: string }>(sql`
    INSERT INTO categories (name, slug, is_active)
    VALUES (${nombre}, ${`vacia-${sufijo}`}, ${activa})
    RETURNING id`);
  sueltas.categorias.push(fila.id);
  return { id: fila.id, nombre };
}

describe("leerCategoriasDeLaTienda (RF-35)", () => {
  test("cuenta solo los productos activos, y no trae las vacías ni las inactivas", async () => {
    const productoId = await unProducto();
    const [{ categoryId, brandId }] = await db.execute<{
      categoryId: string;
      brandId: string;
    }>(sql`
      SELECT category_id AS "categoryId", brand_id AS "brandId"
        FROM products WHERE id = ${productoId}`);
    await db.execute(
      sql`UPDATE products SET is_active = true WHERE id = ${productoId}`,
    );

    // Uno inactivo en la misma categoría: no se cuenta, porque el catálogo
    // no lo muestra.
    const sufijo = randomUUID().slice(0, 8);
    const [inactivo] = await db.execute<{ id: string }>(sql`
      INSERT INTO products (name, slug, brand_id, category_id, price, is_active)
      VALUES (${`Inactivo ${sufijo}`}, ${`inactivo-${sufijo}`}, ${brandId},
              ${categoryId}, '1000.00', false)
      RETURNING id`);
    sueltas.productos.push(inactivo.id);

    const vacia = await unaCategoria(true);
    const apagada = await unaCategoria(false);

    const categorias = await leerCategoriasDeLaTienda();
    const conUno = categorias.find((c) => c.id === categoryId);

    expect(conUno?.cantidad).toBe(1);
    expect(categorias.some((c) => c.id === vacia.id)).toBe(false);
    expect(categorias.some((c) => c.id === apagada.id)).toBe(false);
  });

  test("vienen ordenadas por nombre sin distinguir acentos ni mayúsculas", async () => {
    // Con un orden por bytes, «É» va después de toda la «e» minúscula. Cada
    // una necesita un producto activo: las vacías no vienen.
    const sufijo = randomUUID().slice(0, 8);
    const ids: string[] = [];
    for (const nombre of [`eco ${sufijo}`, `Ébano ${sufijo}`]) {
      const productoId = await unProducto();
      const [{ categoryId }] = await db.execute<{ categoryId: string }>(sql`
        UPDATE products SET is_active = true WHERE id = ${productoId}
        RETURNING category_id AS "categoryId"`);
      await db.execute(
        sql`UPDATE categories SET name = ${nombre} WHERE id = ${categoryId}`,
      );
      ids.push(categoryId);
    }

    const orden = (await leerCategoriasDeLaTienda())
      .filter((c) => ids.includes(c.id))
      .map((c) => c.nombre);
    expect(orden).toEqual([`Ébano ${sufijo}`, `eco ${sufijo}`]);
  });
});

function una(
  nombre: string,
  cantidad: number,
  destacada = false,
): CategoriaDeLaPagina {
  return {
    id: nombre,
    slug: normalizar(nombre),
    nombre,
    cantidad,
    destacada,
    miniaturaUrl: null,
    imagenUrl: null,
  };
}

describe("repartirCategorias (DR §7.6)", () => {
  const categorias = [
    una("Auriculares", 14, true),
    una("Cables", 6),
    una("Micrófonos", 0, true),
    una("Teclados", 9, true),
  ];

  test("sin búsqueda: destacadas con productos arriba, y también en la lista", () => {
    const r = repartirCategorias(categorias, "", 7);
    expect(r.destacadas.map((c) => c.nombre)).toEqual([
      "Auriculares",
      "Teclados",
    ]);
    expect(r.conProductos.map((c) => c.nombre)).toEqual([
      "Auriculares",
      "Cables",
      "Teclados",
    ]);
    // Una destacada sin productos no aparece en ningún lado.
    expect(r.total).toBe(3);
    expect(r.buscando).toBe(false);
  });

  test("las destacadas respetan el tope de la home", () => {
    expect(repartirCategorias(categorias, "", 1).destacadas).toHaveLength(1);
  });

  test("busca sin acentos ni mayúsculas, y mientras busca no hay destacadas", () => {
    const r = repartirCategorias(categorias, "  AURÍCU ", 7);
    expect(r.destacadas).toEqual([]);
    expect(r.conProductos.map((c) => c.nombre)).toEqual(["Auriculares"]);
    expect(r.buscando).toBe(true);

    expect(repartirCategorias(categorias, "microfono", 7).total).toBe(0);
  });

  test("una búsqueda sin resultados da total cero", () => {
    const r = repartirCategorias(categorias, "sillas", 7);
    expect(r.total).toBe(0);
    expect(r.conProductos).toEqual([]);
  });

  test("solo espacios no es buscar", () => {
    expect(repartirCategorias(categorias, "   ", 7).buscando).toBe(false);
  });
});

describe("cantidadDeProductos", () => {
  test("singular y plural", () => {
    expect(cantidadDeProductos(1)).toBe("1 producto");
    expect(cantidadDeProductos(0)).toBe("0 productos");
    expect(cantidadDeProductos(14)).toBe("14 productos");
  });
});

describe("mensajes de la página de categorías (RF-35)", () => {
  test("los dos textos de la especificación", () => {
    expect(mensajeDeBusquedaSinResultados("  sillas ")).toBe(
      "¡Hola! Busqué «sillas» entre las categorías y no lo encontré. ¿Lo tienen o piensan traerlo?",
    );
    expect(mensajeDeConsultaGeneral()).toBe(
      "¡Hola! Quería consultar por algo que no encontré entre las categorías de la tienda.",
    );
  });

  test("viajan codificados: comillas, acentos y signos de pregunta", () => {
    const enlace = enlaceDeWhatsApp(
      "+5492920408825",
      mensajeDeBusquedaSinResultados("micrófono"),
    );
    expect(enlace.startsWith("https://wa.me/5492920408825?text=")).toBe(true);
    expect(decodeURIComponent(enlace.split("text=")[1])).toBe(
      mensajeDeBusquedaSinResultados("micrófono"),
    );
    expect(enlace).not.toMatch(/[«»¿ ]/);
  });
});
