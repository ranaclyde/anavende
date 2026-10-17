import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Los datos de los recorridos de F10.2 — TS §17.2, casos 1 a 5.
 *
 * Cada archivo de `tests/e2e` arma lo suyo y lo borra al terminar, como el de
 * aislamiento (`compradores.ts`): los E2E corren contra la base que lee
 * `next dev`, y no tienen que depender del catálogo sembrado ni dejar nada
 * que después aparezca en una pantalla.
 *
 * **Es una fábrica y no un módulo con la conexión arriba** porque los
 * archivos corren uno detrás del otro en el mismo proceso (`workers: 1`) y
 * comparten los módulos importados: si la conexión fuera de este módulo, el
 * primero que la cerrara al terminar se la cerraría también al siguiente.
 *
 * Habla con la base por su cuenta, sin `@/db`: ese módulo lleva
 * `server-only`, y este archivo corre en el proceso de Playwright.
 */

export const auth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth.admin;

export type Color = { id: string; nombre: string; slug: string };

export type Variante = { id: string; color: Color };

export type ProductoDePrueba = {
  id: string;
  nombre: string;
  slug: string;
  marca: string;
  variantes: Variante[];
};

/** Una palabra que no está en ningún otro producto: se busca por ella. */
export function sufijo(): string {
  return randomUUID().replaceAll("-", "").slice(0, 8);
}

export function datosDePrueba() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

  const creados = {
    usuarios: [] as string[],
    productos: [] as string[],
    marcas: [] as string[],
    categorias: [] as string[],
    colores: [] as string[],
  };
  let casillaOriginal: string | null = null;

  async function unaMarca(nombre: string): Promise<string> {
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO brands (name, slug)
      VALUES (${nombre}, ${`marca-${sufijo()}`}) RETURNING id`;
    creados.marcas.push(fila.id);
    return fila.id;
  }

  async function unaCategoria(nombre: string): Promise<string> {
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO categories (name, slug)
      VALUES (${nombre}, ${`rubro-${sufijo()}`}) RETURNING id`;
    creados.categorias.push(fila.id);
    return fila.id;
  }

  async function unColor(nombre: string, hex: string): Promise<Color> {
    const slug = `color-${sufijo()}`;
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${nombre}, ${slug}, ${hex}) RETURNING id`;
    creados.colores.push(fila.id);
    return { id: fila.id, nombre, slug };
  }

  /** Un producto publicado, con una variante por color y su stock. */
  async function unProducto({
    nombre,
    marca,
    marcaId,
    categoriaId,
    precio,
    colores,
    stock,
  }: {
    nombre: string;
    marca: string;
    marcaId: string;
    categoriaId: string;
    precio: string;
    colores: Color[];
    stock: number;
  }): Promise<ProductoDePrueba> {
    const slug = `e2e-${sufijo()}`;
    const [producto] = await sql<{ id: string }[]>`
      INSERT INTO products (name, slug, brand_id, category_id, price)
      VALUES (${nombre}, ${slug}, ${marcaId}, ${categoriaId}, ${precio})
      RETURNING id`;
    creados.productos.push(producto.id);

    const variantes: Variante[] = [];
    for (const [orden, color] of colores.entries()) {
      const [fila] = await sql<{ id: string }[]>`
        INSERT INTO product_variants
          (product_id, color_id, stock_total, sort_order)
        VALUES (${producto.id}, ${color.id}, ${stock}, ${orden})
        RETURNING id`;
      variantes.push({ id: fila.id, color });
    }

    return { id: producto.id, nombre, slug, marca, variantes };
  }

  /**
   * Para borrar al final una cuenta que el test no creó por la API sino por
   * la pantalla de alta.
   */
  function anotarUsuario(id: string): void {
    creados.usuarios.push(id);
  }

  /**
   * La casilla del E4 se cambia mientras dura el archivo (decisión tuya del
   * 2026-10-17): un pedido confirmado le avisa a la vendedora por Resend, con
   * la clave de verdad de `.env.local`. `delivered@resend.dev` es la
   * dirección de prueba de Resend: acepta el envío y no se lo entrega a
   * nadie. Gasta uno del cupo por corrida, y el aviso igual se ejercita.
   */
  async function casillaDeAvisosDePrueba(): Promise<void> {
    const [fila] = await sql<{ email: string }[]>`
      SELECT admin_notification_email AS email FROM site_settings WHERE id = 1`;
    if (!fila)
      throw new Error("La base local no tiene fila en `site_settings`.");
    casillaOriginal = fila.email;
    await sql`
      UPDATE site_settings SET admin_notification_email = 'delivered@resend.dev'
       WHERE id = 1`;
  }

  /** El número al que apuntan los enlaces de WhatsApp, solo los dígitos. */
  async function numeroDeWhatsApp(): Promise<string> {
    const [fila] = await sql<{ numero: string }[]>`
      SELECT whatsapp_number AS numero FROM site_settings WHERE id = 1`;
    return fila.numero.replace(/\D/g, "");
  }

  /**
   * Las órdenes antes que las cuentas, por el CHECK `web_order_has_user`, y
   * antes que los productos, porque sus renglones apuntan a las variantes.
   * Borrar la cuenta en GoTrue se lleva en cascada el perfil, el carrito,
   * las direcciones y los favoritos.
   */
  async function desarmar(): Promise<void> {
    if (casillaOriginal !== null) {
      await sql`
        UPDATE site_settings SET admin_notification_email = ${casillaOriginal}
         WHERE id = 1`;
      casillaOriginal = null;
    }
    for (const id of creados.usuarios.splice(0)) {
      await sql`DELETE FROM orders WHERE user_id = ${id}`;
      const { error } = await auth.deleteUser(id);
      if (error) throw error;
    }
    for (const id of creados.productos.splice(0)) {
      await sql`
        DELETE FROM orders WHERE id IN (
          SELECT i.order_id FROM order_items i
            JOIN product_variants v ON v.id = i.variant_id
           WHERE v.product_id = ${id})`;
      await sql`DELETE FROM products WHERE id = ${id}`;
    }
    for (const id of creados.marcas.splice(0)) {
      await sql`DELETE FROM brands WHERE id = ${id}`;
    }
    for (const id of creados.categorias.splice(0)) {
      await sql`DELETE FROM categories WHERE id = ${id}`;
    }
    for (const id of creados.colores.splice(0)) {
      await sql`DELETE FROM colors WHERE id = ${id}`;
    }
    await sql.end();
  }

  return {
    sql,
    unaMarca,
    unaCategoria,
    unColor,
    unProducto,
    anotarUsuario,
    casillaDeAvisosDePrueba,
    numeroDeWhatsApp,
    desarmar,
  };
}
