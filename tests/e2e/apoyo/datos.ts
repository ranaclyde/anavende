import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import sharp from "sharp";

/**
 * Cada archivo de `tests/e2e` arma sus datos y los borra al terminar: los E2E
 * corren contra la base que lee `next dev`.
 *
 * **Es una fábrica y no un módulo con la conexión arriba**: los archivos
 * corren en el mismo proceso (`workers: 1`) y comparten los módulos, así que
 * el primero que cerrara la conexión se la cerraría también al siguiente.
 *
 * Sin `@/db`: ese módulo lleva `server-only` y esto corre en Playwright.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export const auth = supabase.auth.admin;

const bucket = supabase.storage.from(process.env.SUPABASE_STORAGE_BUCKET!);

export type Color = { id: string; nombre: string; slug: string };

export type Variante = { id: string; color: Color };

export type ProductoDePrueba = {
  id: string;
  nombre: string;
  slug: string;
  marca: string;
  variantes: Variante[];
};

export type Cuenta = {
  id: string;
  email: string;
  password: string;
  nombre: string;
};

export type Orden = { id: string; numero: number };

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
    mediosDePago: [] as { id: string; archivo: string | null }[],
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

  /** Una variante «Único», sin color. */
  async function unaVarianteUnica(productoId: string, stock = 1) {
    await sql`
      INSERT INTO product_variants (product_id, color_id, stock_total)
      VALUES (${productoId}, NULL, ${stock})`;
  }

  async function slugDeCategoria(id: string): Promise<string> {
    const [fila] = await sql<{ slug: string }[]>`
      SELECT slug FROM categories WHERE id = ${id}`;
    return fila.slug;
  }

  async function unColor(nombre: string, hex: string): Promise<Color> {
    const slug = `color-${sufijo()}`;
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO colors (name, slug, hex_code)
      VALUES (${nombre}, ${slug}, ${hex}) RETURNING id`;
    creados.colores.push(fila.id);
    return { id: fila.id, nombre, slug };
  }

  async function unProducto({
    nombre,
    marca,
    marcaId,
    categoriaId,
    precio,
    colores,
    stock,
    sku = null,
  }: {
    nombre: string;
    marca: string;
    marcaId: string;
    categoriaId: string;
    precio: string;
    colores: Color[];
    stock: number;
    sku?: string | null;
  }): Promise<ProductoDePrueba> {
    const slug = `e2e-${sufijo()}`;
    const [producto] = await sql<{ id: string }[]>`
      INSERT INTO products (name, slug, brand_id, category_id, price, sku)
      VALUES (${nombre}, ${slug}, ${marcaId}, ${categoriaId}, ${precio},
              ${sku})
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
   * Con el email ya verificado, para entrar por `/ingresar`. El rol del
   * perfil es lo único que separa a la administradora de una compradora.
   */
  async function unaCuenta(
    nombre: string,
    rol: "admin" | "customer" = "customer",
  ): Promise<Cuenta> {
    const email = `e2e-${nombre.toLowerCase()}-${sufijo()}@ejemplo.test`;
    const password = `Prueba-${randomUUID()}`;

    const { data, error } = await auth.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    creados.usuarios.push(data.user.id);

    await sql`
      INSERT INTO user_profiles (id, first_name, last_name, email, phone, role)
      VALUES (${data.user.id}, ${nombre}, 'De Prueba', ${email},
              '+5492920555555', ${rol})`;

    return { id: data.user.id, email, password, nombre };
  }

  /**
   * Una orden web activa **con el stock reservado**, como la deja el
   * checkout: sin la reserva, finalizarla no tendría qué descontar.
   */
  async function unaOrden(
    cuenta: Cuenta,
    renglones: {
      variante: Variante;
      producto: ProductoDePrueba;
      cantidad: number;
      precio: string;
    }[],
  ): Promise<Orden> {
    const [orden] = await sql<Orden[]>`
      INSERT INTO orders
        (user_id, origin, status, customer_name, customer_email,
         customer_phone, total)
      VALUES
        (${cuenta.id}, 'web', 'activa', ${cuenta.nombre}, ${cuenta.email},
         '+5492920555555', '0.00')
      RETURNING id, order_number AS numero`;

    for (const r of renglones) {
      await sql`
        INSERT INTO order_items
          (order_id, variant_id, product_name, brand_name, color_name,
           unit_price, quantity)
        VALUES
          (${orden.id}, ${r.variante.id}, ${r.producto.nombre},
           ${r.producto.marca}, ${r.variante.color.nombre}, ${r.precio},
           ${r.cantidad})`;
      await sql`
        UPDATE product_variants
           SET reserved_stock = reserved_stock + ${r.cantidad}
         WHERE id = ${r.variante.id}`;
    }
    await sql`
      UPDATE orders SET total = (
        SELECT sum(subtotal) FROM order_items WHERE order_id = ${orden.id})
       WHERE id = ${orden.id}`;
    await sql`
      INSERT INTO order_status_history (order_id, from_status, to_status)
      VALUES (${orden.id}, NULL, 'activa')`;

    return orden;
  }

  /**
   * Sin logo, un medio de pago no entra en la hilera de la portada. Se sube
   * solo la miniatura, la única que la hilera pide.
   */
  async function unMedioDePagoConLogo(nombre: string): Promise<void> {
    const base = `e2e/logo-${sufijo()}`;
    const archivo = `${base}-thumb.webp`;
    const logo = await sharp({
      create: { width: 96, height: 48, channels: 3, background: "#2f4a6d" },
    })
      .webp()
      .toBuffer();
    const { error } = await bucket.upload(archivo, logo, {
      contentType: "image/webp",
    });
    if (error) throw error;

    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO payment_methods (name, logo_key)
      VALUES (${nombre}, ${base}) RETURNING id`;
    creados.mediosDePago.push({ id: fila.id, archivo });
  }

  /** Sin logo, al final de la lista. */
  async function unMedioDePago(nombre: string): Promise<string> {
    const [fila] = await sql<{ id: string }[]>`
      INSERT INTO payment_methods (name, sort_order)
      VALUES (${nombre},
              (SELECT coalesce(max(sort_order), -1) + 1 FROM payment_methods))
      RETURNING id`;
    creados.mediosDePago.push({ id: fila.id, archivo: null });
    return fila.id;
  }

  /** Para borrar al final lo que se creó por una pantalla y no por acá. */
  function anotarUsuario(id: string): void {
    creados.usuarios.push(id);
  }

  function anotarProducto(id: string): void {
    creados.productos.push(id);
  }

  function anotarDelCatalogo(
    lista: "marcas" | "categorias" | "colores",
    id: string,
  ): void {
    creados[lista].push(id);
  }

  /**
   * El storage no tiene carpetas de verdad: se lista cada variante y se borra
   * lo que hay adentro.
   */
  async function borrarFotos(productId: string): Promise<void> {
    const raiz = `productos/${productId}`;
    const { data: variantes, error } = await bucket.list(raiz);
    if (error) throw error;

    for (const variante of variantes) {
      const carpeta = `${raiz}/${variante.name}`;
      const { data: archivos, error: alListar } = await bucket.list(carpeta);
      if (alListar) throw alListar;
      if (archivos.length === 0) continue;

      const { error: alBorrar } = await bucket.remove(
        archivos.map((a) => `${carpeta}/${a.name}`),
      );
      if (alBorrar) throw alBorrar;
    }
  }

  /** Borrar la cuenta se lleva la fila, no el archivo de Storage. */
  async function borrarFotoDePerfil(userId: string): Promise<void> {
    const carpeta = `usuarios/${userId}`;
    const { data: archivos, error } = await bucket.list(carpeta);
    if (error) throw error;
    if (archivos.length === 0) return;

    const { error: alBorrar } = await bucket.remove(
      archivos.map((a) => `${carpeta}/${a.name}`),
    );
    if (alBorrar) throw alBorrar;
  }

  /**
   * Un pedido confirmado avisa por Resend con la clave real de `.env.local`:
   * `delivered@resend.dev` acepta el envío y no se lo entrega a nadie. Gasta
   * uno del cupo por corrida.
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

  /** Solo los dígitos. */
  async function numeroDeWhatsApp(): Promise<string> {
    const [fila] = await sql<{ numero: string }[]>`
      SELECT whatsapp_number AS numero FROM site_settings WHERE id = 1`;
    return fila.numero.replace(/\D/g, "");
  }

  async function borrarArchivo(clave: string): Promise<void> {
    const { error } = await bucket.remove([clave]);
    if (error) throw error;
  }

  /**
   * Las órdenes antes que las cuentas, por el CHECK `web_order_has_user`, y
   * antes que los productos, porque sus renglones apuntan a las variantes.
   * Borrar la cuenta en GoTrue se lleva en cascada el resto.
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
      await borrarFotoDePerfil(id);
    }
    for (const id of creados.productos.splice(0)) {
      await sql`
        DELETE FROM orders WHERE id IN (
          SELECT i.order_id FROM order_items i
            JOIN product_variants v ON v.id = i.variant_id
           WHERE v.product_id = ${id})`;
      await sql`DELETE FROM products WHERE id = ${id}`;
      await borrarFotos(id);
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
    for (const { id, archivo } of creados.mediosDePago.splice(0)) {
      // Se lleva sus promociones de cuotas en cascada.
      await sql`DELETE FROM payment_methods WHERE id = ${id}`;
      if (archivo === null) continue;
      const { error } = await bucket.remove([archivo]);
      if (error) throw error;
    }
    await sql.end();
  }

  return {
    sql,
    unaMarca,
    unaCategoria,
    slugDeCategoria,
    unaVarianteUnica,
    unColor,
    unProducto,
    unaCuenta,
    unaOrden,
    unMedioDePagoConLogo,
    unMedioDePago,
    anotarUsuario,
    anotarProducto,
    anotarDelCatalogo,
    casillaDeAvisosDePrueba,
    numeroDeWhatsApp,
    borrarArchivo,
    desarmar,
  };
}
