import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { expect, test, type Browser, type Page } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { auth, datosDePrueba, type Cuenta, type Orden } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.3 — Todas las pantallas pasan axe. DESIGN-REFERENCE §9, FS RNF-02.
 *
 * Cada página de `app/` se abre con los datos que la llenan —un producto
 * con dos colores, una compradora con dirección, carrito, favorito y un
 * pedido, y la administradora— y se le pasa axe con las reglas de WCAG 2.2
 * AA. La tienda se mira en el teléfono y en la computadora; el panel, además,
 * en oscuro, que es donde el contraste se rompió antes (2026-09-18).
 *
 * **El primer test es el que hace que esto no se olvide**: falla si hay una
 * página en `app/` que no está en `PANTALLAS`. Una pantalla nueva entra al
 * repaso o dice por qué no.
 *
 * Lo que axe no puede ver —teclado, foco, zoom, color como único portador—
 * está en la lista de `DESIGN.md`.
 */

// Cada recorrido abre unas veinte pantallas, y `next dev` compila cada una la
// primera vez.
test.describe.configure({ timeout: 600_000 });
// Un botón que no aparece falla en segundos, no al final de los diez minutos.
test.use({ actionTimeout: 15_000 });

const datos = datosDePrueba();

let admin: Cuenta;
let compradora: Cuenta;
let sinPerfil: Cuenta;
let orden: Orden;
let producto: { id: string; slug: string };
let direccion: string;

type Quien = "visitante" | "compradora" | "admin" | "sinPerfil";

type Pantalla = {
  /** La ruta como sale del archivo: `/productos/[slug]`. */
  ruta: string;
  quien: Quien;
  /** La dirección concreta, si la ruta tiene partes variables. */
  url?: () => string;
};

/**
 * Todas las páginas de `app/`. Una que no se pueda abrir va en
 * `SIN_REVISAR`, con el motivo.
 */
const PANTALLAS: Pantalla[] = [
  // La tienda, sin cuenta.
  { ruta: "/", quien: "visitante" },
  { ruta: "/productos", quien: "visitante" },
  { ruta: "/categorias", quien: "visitante" },
  {
    ruta: "/productos/[slug]",
    quien: "visitante",
    url: () => `/productos/${producto.slug}`,
  },
  {
    ruta: "/legales/[slug]",
    quien: "visitante",
    url: () => "/legales/garantias",
  },
  { ruta: "/contacto", quien: "visitante" },
  { ruta: "/nosotros", quien: "visitante" },
  { ruta: "/ingresar", quien: "visitante" },
  { ruta: "/registro", quien: "visitante" },
  {
    ruta: "/registro/verificar",
    quien: "visitante",
    url: () => "/registro/verificar?email=alguien%40ejemplo.test",
  },
  { ruta: "/recuperar", quien: "visitante" },
  { ruta: "/recuperar/nueva-contrasena", quien: "visitante" },
  { ruta: "/error", quien: "visitante" },

  // La tienda, con la compradora.
  { ruta: "/carrito", quien: "compradora" },
  { ruta: "/checkout", quien: "compradora" },
  { ruta: "/mi-cuenta", quien: "compradora" },
  { ruta: "/mi-cuenta/baja", quien: "compradora" },
  { ruta: "/mi-cuenta/compras", quien: "compradora" },
  {
    ruta: "/mi-cuenta/compras/[numero]",
    quien: "compradora",
    url: () => `/mi-cuenta/compras/${orden.numero}`,
  },
  { ruta: "/mi-cuenta/direcciones", quien: "compradora" },
  { ruta: "/mi-cuenta/direcciones/nueva", quien: "compradora" },
  {
    ruta: "/mi-cuenta/direcciones/[id]",
    quien: "compradora",
    url: () => `/mi-cuenta/direcciones/${direccion}`,
  },
  { ruta: "/mi-cuenta/favoritos", quien: "compradora" },
  {
    ruta: "/orden/[numero]",
    quien: "compradora",
    url: () => `/orden/${orden.numero}`,
  },

  // Quien entró y todavía no tiene perfil: el paso de Google y Facebook.
  { ruta: "/completar-perfil", quien: "sinPerfil" },

  // El panel.
  { ruta: "/admin", quien: "admin" },
  { ruta: "/admin/catalogo/categorias", quien: "admin" },
  { ruta: "/admin/catalogo/colores", quien: "admin" },
  { ruta: "/admin/catalogo/marcas", quien: "admin" },
  { ruta: "/admin/catalogo/medios-de-pago", quien: "admin" },
  { ruta: "/admin/configuracion", quien: "admin" },
  { ruta: "/admin/devoluciones", quien: "admin" },
  {
    ruta: "/admin/legales/[slug]",
    quien: "admin",
    url: () => "/admin/legales/garantias",
  },
  { ruta: "/admin/ordenes", quien: "admin" },
  {
    ruta: "/admin/ordenes/[numero]",
    quien: "admin",
    url: () => `/admin/ordenes/${orden.numero}`,
  },
  { ruta: "/admin/ordenes/nueva", quien: "admin" },
  { ruta: "/admin/productos", quien: "admin" },
  {
    ruta: "/admin/productos/[id]",
    quien: "admin",
    url: () => `/admin/productos/${producto.id}`,
  },
  { ruta: "/admin/productos/nuevo", quien: "admin" },
  { ruta: "/admin/reportes", quien: "admin" },
  { ruta: "/admin/usuarios", quien: "admin" },
  {
    ruta: "/admin/usuarios/[id]",
    quien: "admin",
    url: () => `/admin/usuarios/${compradora.id}`,
  },
  { ruta: "/admin/usuarios/nuevo", quien: "admin" },
];

const SIN_REVISAR: Record<string, string> = {
  "/admin/catalogo": "solo redirige a /admin/catalogo/marcas",
  "/admin/legales": "solo redirige a la primera página legal",
  "/mantenimiento":
    "con la tienda abierta manda al inicio, y cerrarla corta los demás tests",
};

/** `app/(shop)/productos/[slug]/page.tsx` → `/productos/[slug]`. */
function rutasDeApp(carpeta = join(process.cwd(), "app")): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) return rutasDeApp(ruta);
    if (e.name !== "page.tsx") return [];
    const partes = relative(join(process.cwd(), "app"), carpeta)
      .split(sep)
      .filter((p) => p && !/^\(.*\)$/.test(p));
    return [`/${partes.join("/")}`];
  });
}

test.beforeAll(async () => {
  const palabra = Math.random().toString(36).slice(2, 8);
  const marca = `Teclas ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Teclados ${palabra}`);
  const negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  const blanco = await datos.unColor(`Blanco ${palabra}`, "#FFFFFF");
  const teclado = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [negro, blanco],
    stock: 5,
  });
  producto = teclado;

  // La hilera de la portada solo aparece con un medio de pago con logo.
  await datos.unMedioDePagoConLogo(`Tarjeta ${palabra}`);

  admin = await datos.unaCuenta("Ana", "admin");
  compradora = await datos.unaCuenta("Compradora");
  orden = await datos.unaOrden(compradora, [
    {
      variante: teclado.variantes[0],
      producto: teclado,
      cantidad: 1,
      precio: "24500.00",
    },
  ]);

  const [fila] = await datos.sql<{ id: string }[]>`
    INSERT INTO addresses
      (user_id, label, recipient_name, phone, street, number,
       city, province, postal_code, is_default)
    VALUES
      (${compradora.id}, 'Casa', 'Compradora De Prueba', '+5492920555555',
       'Av. Siempreviva', '742', 'Viedma', 'Río Negro', '8500', true)
    RETURNING id`;
  direccion = fila.id;

  const [carrito] = await datos.sql<{ id: string }[]>`
    INSERT INTO carts (user_id) VALUES (${compradora.id}) RETURNING id`;
  await datos.sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    VALUES (${carrito.id}, ${teclado.variantes[1].id}, 1, '24500.00')`;
  await datos.sql`
    INSERT INTO favorites (user_id, product_id)
    VALUES (${compradora.id}, ${teclado.id})`;

  // Una cuenta de GoTrue sin perfil, como la que deja Google la primera vez.
  const email = `e2e-sinperfil-${palabra}@ejemplo.test`;
  const password = `Prueba-${palabra}-${Date.now()}`;
  const { data, error } = await auth.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  datos.anotarUsuario(data.user.id);
  sinPerfil = { id: data.user.id, email, password, nombre: "Sin perfil" };
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("todas las páginas de app/ están en el repaso", () => {
  const listadas = new Set([
    ...PANTALLAS.map((p) => p.ruta),
    ...Object.keys(SIN_REVISAR),
  ]);
  const faltan = rutasDeApp().filter((r) => !listadas.has(r));
  expect(faltan, "páginas sin revisar: sumalas a PANTALLAS").toEqual([]);
});

/** Un navegador por persona y por forma, con la sesión ya puesta. */
async function navegador(
  browser: Browser,
  quien: Quien,
  forma: "telefono" | "computadora",
  oscuro = false,
): Promise<Page> {
  const contexto = await browser.newContext(
    forma === "telefono"
      ? // 320 es el ancho que pide WCAG 1.4.10, y el que queda de una
        // computadora de 640 con el zoom al 200% (§9).
        {
          viewport: { width: 320, height: 640 },
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1280, height: 900 } },
  );
  if (oscuro) {
    await contexto.addInitScript(() => {
      localStorage.setItem("anavende:admin-theme", "dark");
    });
  }
  const page = await contexto.newPage();
  if (quien === "admin") await ingresar(page, admin);
  if (quien === "compradora") await ingresar(page, compradora);
  if (quien === "sinPerfil") await ingresar(page, sinPerfil);
  return page;
}

async function revisar(page: Page, pantallas: Pantalla[], etiqueta: string) {
  for (const p of pantallas) {
    const url = p.url?.() ?? p.ruta;
    // No `networkidle`: Turnstile y el servidor de desarrollo nunca dejan
    // la red quieta. Alcanza con que la página haya cargado y hidratado.
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(500);

    // Si la pantalla mandó a otro lado, axe revisaría la equivocada.
    expect
      .soft(new URL(page.url()).pathname, `${etiqueta} ${url} redirigió`)
      .toBe(url.split("?")[0]);

    const hallazgos = await hallazgosDeAxe(page);
    expect.soft(hallazgos, `${etiqueta} ${url}`).toEqual([]);

    // Sin scroll horizontal de la página entera: una tabla puede deslizarse
    // dentro de su caja, la pantalla no.
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect.soft(sobra, `${etiqueta} ${url} se sale de costado`).toBe(0);
  }
}

for (const forma of ["telefono", "computadora"] as const) {
  for (const quien of ["visitante", "compradora", "sinPerfil"] as const) {
    test(`la tienda, ${quien}, en ${forma}`, async ({ browser }) => {
      const page = await navegador(browser, quien, forma);
      await revisar(
        page,
        PANTALLAS.filter((p) => p.quien === quien),
        `${quien} en ${forma}:`,
      );
      await page.context().close();
    });
  }

  for (const oscuro of [false, true]) {
    const tema = oscuro ? "oscuro" : "claro";
    test(`el panel, en ${forma}, ${tema}`, async ({ browser }) => {
      const page = await navegador(browser, "admin", forma, oscuro);
      await revisar(
        page,
        PANTALLAS.filter((p) => p.quien === "admin"),
        `panel en ${forma}, ${tema}:`,
      );
      await page.context().close();
    });
  }
}

/**
 * Los diálogos no están en la página hasta que se abren, así que axe no los
 * ve en el recorrido de arriba. Se abre uno de cada clase y se mira, además,
 * lo que axe no puede: que **el foco entre** al abrirlo y **vuelva al botón**
 * al cerrarlo con Escape. Ninguno se confirma: todos se cierran sin hacer
 * nada.
 */
type Dialogo = {
  quien: "compradora" | "admin";
  url: () => string;
  boton: () => string;
  /** Lo que habilita el botón, si hace falta. */
  antes?: (page: Page) => Promise<void>;
};

const DIALOGOS: Dialogo[] = [
  {
    quien: "compradora",
    url: () => "/carrito",
    boton: () => "Vaciar el carrito",
  },
  {
    quien: "compradora",
    url: () => `/mi-cuenta/compras/${orden.numero}`,
    boton: () => "Cancelar el pedido",
  },
  {
    quien: "compradora",
    url: () => "/mi-cuenta/direcciones",
    boton: () => "Eliminar «Casa»",
  },
  {
    quien: "admin",
    url: () => `/admin/usuarios/${compradora.id}`,
    boton: () => "Restablecer contraseña",
  },
  {
    quien: "admin",
    url: () => `/admin/usuarios/${compradora.id}`,
    boton: () => "Cambiar el rol",
    // Se habilita al elegir un rol distinto del que tiene.
    antes: async (page) => {
      const rol = page.getByLabel(/^Rol de /);
      const otro = await rol.evaluate(
        (s: HTMLSelectElement) =>
          [...s.options].find((o) => o.value !== s.value)!.value,
      );
      await rol.selectOption(otro);
    },
  },
  {
    quien: "admin",
    url: () => `/admin/usuarios/${compradora.id}`,
    boton: () => "Bloquear la cuenta",
  },
  {
    quien: "admin",
    url: () => `/admin/ordenes/${orden.numero}`,
    boton: () => "Finalizar",
  },
  {
    quien: "admin",
    url: () => `/admin/ordenes/${orden.numero}`,
    boton: () => "Cancelar la orden",
  },
  {
    quien: "admin",
    url: () => `/admin/ordenes/${orden.numero}`,
    boton: () => "Agregar un producto",
  },
  {
    quien: "admin",
    url: () => "/admin/ordenes/nueva",
    boton: () => "Agregar productos",
  },
  {
    quien: "admin",
    url: () => "/admin/ordenes/nueva",
    boton: () => "Asociar una cuenta",
  },
  {
    quien: "admin",
    url: () => "/admin/catalogo/marcas",
    boton: () => "Nueva marca",
  },
  {
    quien: "admin",
    url: () => "/admin/catalogo/medios-de-pago",
    boton: () => "Nuevo medio de pago",
  },
  {
    quien: "admin",
    url: () => `/admin/productos/${producto.id}`,
    boton: () => "Agregar color",
  },
  {
    quien: "admin",
    url: () => "/admin/configuracion",
    boton: () => "Cerrar la tienda al público",
  },
];

/**
 * A mitad del fundido de entrada, axe mide colores que nadie llega a leer.
 * Las que no terminan nunca —la hilera de la portada— no se esperan.
 */
async function animacionesTerminadas(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

for (const quien of ["compradora", "admin"] as const) {
  test(`los diálogos, ${quien}`, async ({ browser }) => {
    const page = await navegador(browser, quien, "computadora");
    for (const d of DIALOGOS.filter((x) => x.quien === quien)) {
      const etiqueta = `${d.url()} «${d.boton()}»:`;
      await page.goto(d.url(), { waitUntil: "load" });
      // Que termine de hidratar: abierto antes, el diálogo marca con
      // `aria-hidden` lo que React todavía no hidrató, y React lo reporta.
      await page.waitForTimeout(500);
      await d.antes?.(page);
      const boton = page.getByRole("button", { name: d.boton(), exact: true });
      await boton.click();

      const dialogo = page.locator('[role="dialog"], [role="alertdialog"]');
      await expect(dialogo).toBeVisible();
      await animacionesTerminadas(page);

      const adentro = await dialogo.evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect.soft(adentro, `${etiqueta} el foco no entró`).toBe(true);

      expect
        .soft(
          await hallazgosDeAxe(page, '[role="dialog"], [role="alertdialog"]'),
          etiqueta,
        )
        .toEqual([]);

      await page.keyboard.press("Escape");
      await expect(dialogo).toBeHidden();
      await expect.soft(boton, `${etiqueta} el foco no volvió`).toBeFocused();
    }
    await page.context().close();
  });
}

/**
 * El selector con buscador (F2.11) tampoco está en la página hasta que se
 * abre. Se mira lo mismo que en los diálogos: axe sobre la lista, el foco en
 * el buscador al abrir y de vuelta en el campo al cerrar con Escape.
 */
test("el selector con buscador, abierto", async ({ browser }) => {
  const page = await navegador(browser, "admin", "computadora");
  await page.goto("/admin/productos/nuevo", { waitUntil: "load" });
  await page.waitForTimeout(500);

  const selector = page.getByRole("combobox", { name: "Marca" });
  await selector.click();
  const lista = page.locator('[data-slot="popover-content"]');
  await expect(lista).toBeVisible();
  await animacionesTerminadas(page);

  await expect(
    lista.getByRole("combobox"),
    "el foco no entró al buscador",
  ).toBeFocused();
  expect(await hallazgosDeAxe(page, '[data-slot="popover-content"]')).toEqual(
    [],
  );

  await page.keyboard.press("Escape");
  await expect(lista).toBeHidden();
  await expect(selector, "el foco no volvió").toBeFocused();
  await page.context().close();
});

test("los filtros del catálogo y el menú del panel, en el teléfono", async ({
  browser,
}) => {
  const tienda = await navegador(browser, "visitante", "telefono");
  await tienda.goto("/productos", { waitUntil: "load" });
  await tienda.locator("summary").first().click();
  await tienda.waitForTimeout(300);
  expect.soft(await hallazgosDeAxe(tienda), "filtros abiertos").toEqual([]);
  await tienda.context().close();

  const panel = await navegador(browser, "admin", "telefono");
  await panel.goto("/admin", { waitUntil: "load" });
  // Cerrado, el menú no toma el foco: el primer Tab después de «Abrir el
  // menú» ya está en la página.
  const abrir = panel.getByRole("button", { name: "Abrir el menú" });
  const menu = panel.getByRole("complementary", {
    name: "Secciones del panel",
  });
  await expect(menu).toBeHidden();
  await abrir.focus();
  await panel.keyboard.press("Tab");
  expect
    .soft(
      await panel.evaluate(() => !!document.activeElement?.closest("aside")),
      "el menú cerrado tomó el foco",
    )
    .toBe(false);

  await abrir.click();
  await expect(menu).toBeVisible();
  await animacionesTerminadas(panel);
  await expect
    .soft(panel.getByRole("button", { name: "Cerrar el menú" }).last())
    .toBeFocused();
  expect
    .soft(await hallazgosDeAxe(panel, "aside"), "menú del panel")
    .toEqual([]);
  // Abierto, Tab no se va a la página tapada (F2.15): queda inerte.
  await expect(abrir).toHaveAttribute("aria-expanded", "true");
  for (let i = 0; i < 20; i++) {
    await panel.keyboard.press("Tab");
    expect
      .soft(
        await panel.evaluate(() => !!document.activeElement?.closest("main")),
        "Tab llegó a la página tapada por el menú",
      )
      .toBe(false);
  }
  await panel.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect.soft(abrir, "el foco no volvió al menú").toBeFocused();
  await panel.context().close();
});
