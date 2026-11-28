import { expect, test, type Page } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta, type Orden } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Las guías de la tienda y del panel (FS RF-36, RF-37): **aparecen solas la
 * primera vez y nunca más**, el foco entra y vuelve a «Ayuda», y axe sobre
 * el globo, que `accesibilidad.spec` no ve.
 *
 * Los demás E2E arrancan con las guías vistas (`apoyo/test.ts`); este no.
 */

test.describe.configure({ mode: "serial" });
test.use({ ayudasVistas: false });

const datos = datosDePrueba();
let slug: string;
let productoId: string;
let compradora: Cuenta;
let admin: Cuenta;
let orden: Orden;
let devolucionId: string;

test.beforeAll(async () => {
  const palabra = sufijo();
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
  slug = teclado.slug;
  productoId = teclado.id;

  compradora = await datos.unaCuenta("Compradora");
  orden = await datos.unaOrden(compradora, [
    {
      variante: teclado.variantes[0],
      producto: teclado,
      cantidad: 1,
      precio: "24500.00",
    },
  ]);

  // La guía de devoluciones necesita una, sobre una orden finalizada.
  admin = await datos.unaCuenta("Administradora", "admin");
  const entregada = await datos.unaOrden(compradora, [
    {
      variante: teclado.variantes[1],
      producto: teclado,
      cantidad: 1,
      precio: "24500.00",
    },
  ]);
  await datos.sql`
    UPDATE orders SET status = 'finalizada', finalized_at = now()
     WHERE id = ${entregada.id}`;
  const [devolucion] = await datos.sql<{ id: string }[]>`
    INSERT INTO returns (order_id, status, reason)
    VALUES (${entregada.id}, 'registrada', 'Le quedaba chico')
    RETURNING id`;
  devolucionId = devolucion.id;
  await datos.sql`
    INSERT INTO return_items (return_id, order_item_id, quantity, restocks)
    SELECT ${devolucionId}, id, 1, true
      FROM order_items WHERE order_id = ${entregada.id}`;

  // El checkout sin nada en el carrito vuelve al carrito.
  const [carrito] = await datos.sql<{ id: string }[]>`
    INSERT INTO carts (user_id) VALUES (${compradora.id}) RETURNING id`;
  await datos.sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    VALUES (${carrito.id}, ${teclado.variantes[1].id}, 1, '24500.00')`;
});

test.afterAll(async () => {
  // La devolución traba el borrado de su orden (`restrict`).
  if (devolucionId) {
    await datos.sql`DELETE FROM returns WHERE id = ${devolucionId}`;
  }
  await datos.desarmar();
});

const globo = (page: Page) => page.getByRole("dialog");

/**
 * **Con el fundido terminado**: a mitad, el globo es semitransparente y axe
 * mide el contraste contra lo que se ve a través.
 */
async function axeDelGlobo(page: Page): Promise<string[]> {
  // Solo las del globo: con sesión, la cara del encabezado se anima para
  // siempre y esperar a todas no terminaría nunca.
  await page.evaluate(() =>
    Promise.all(
      document
        .querySelector(".driver-popover")!
        .getAnimations()
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  return hallazgosDeAxe(page, ".driver-popover");
}

/**
 * El botón existe desde el servidor, así que verlo no alcanza: la guía se
 * decide en un efecto después de hidratar, y no deja rastro cuando decide no
 * abrirse. Un segundo cubre ese margen en `next dev` ya compilado.
 */
async function sinGuia(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(globo(page)).toBeHidden();
}

test("la ficha: aparece la primera vez, se recorre con teclado y no vuelve", async ({
  page,
}) => {
  await page.goto(`/productos/${slug}`);

  // Sin sesión el segundo paso habla de la cuenta, no del carrito.
  await expect(globo(page)).toHaveAccessibleName("Elegí tu color");
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeFocused();
  expect(await axeDelGlobo(page)).toEqual([]);

  await page.keyboard.press("Enter");
  await expect(globo(page)).toHaveAccessibleName("Comprá con tu cuenta");

  await page.keyboard.press("Escape");
  await expect(globo(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeFocused();

  await page.reload();
  await sinGuia(page);

  await page.getByRole("button", { name: "Ayuda" }).click();
  await expect(globo(page)).toHaveAccessibleName("Elegí tu color");

  for (let i = 0; i < 4; i++) {
    const listo = page.getByRole("button", { name: "Listo" });
    if (await listo.isVisible()) break;
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  await expect(globo(page)).toHaveAccessibleName("Acá no se paga nada");
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(globo(page)).toBeHidden();
});

test("sin stock, la ficha no ofrece la guía", async ({ page }) => {
  const palabra = sufijo();
  const marca = `Agotada ${palabra}`;
  const agotado = await datos.unProducto({
    nombre: `Agotado ${palabra}`,
    marca,
    marcaId: await datos.unaMarca(marca),
    categoriaId: await datos.unaCategoria(`Agotados ${palabra}`),
    precio: "24500.00",
    colores: [await datos.unColor(`Gris ${palabra}`, "#888888")],
    stock: 0,
  });

  await page.goto(`/productos/${agotado.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeHidden();
});

test("el globo entra a 320px sin desbordar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/productos/${slug}`);

  await expect(globo(page)).toBeVisible();
  const caja = await globo(page).boundingBox();
  expect(caja?.x).toBeGreaterThanOrEqual(0);
  expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(await axeDelGlobo(page)).toEqual([]);

  // Driver.js le escribe `display: block` en línea a la cruz: si le gana al
  // `inline-flex`, el ícono se va arriba a la izquierda.
  const cerrar = page.getByRole("button", { name: "Cerrar la guía" });
  const circulo = await cerrar.boundingBox();
  const cruz = await cerrar.locator("svg").boundingBox();
  const centro = (c: typeof cruz) =>
    c ? [c.x + c.width / 2, c.y + c.height / 2] : [];
  const [cx, cy] = centro(circulo);
  const [ix, iy] = centro(cruz);
  expect(Math.abs(cx - ix)).toBeLessThanOrEqual(1);
  expect(Math.abs(cy - iy)).toBeLessThanOrEqual(1);

  await cerrar.click();
  await expect(globo(page)).toBeHidden();
});

test("el checkout y «Mis compras» tienen la suya, una vez cada una", async ({
  page,
}) => {
  await ingresar(page, compradora);

  await page.goto("/checkout");
  await expect(globo(page)).toHaveAccessibleName("¿Envío o retiro?");
  await page.getByRole("button", { name: "Cerrar la guía" }).click();
  await expect(globo(page)).toBeHidden();

  await page.goto("/mi-cuenta/compras");
  await expect(globo(page)).toHaveAccessibleName("Todo lo que pediste");
  await page.keyboard.press("Escape");

  await page.goto(`/mi-cuenta/compras/${orden.numero}`);
  // El paso de WhatsApp se saltea si el stack no tiene número configurado.
  await expect(globo(page)).toHaveAccessibleName(
    /^(Seguimos por WhatsApp|¿Cambiaste de idea\?)$/,
  );
  expect(await axeDelGlobo(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await page.goto("/checkout");
  await sinGuia(page);
  await page.goto("/mi-cuenta/compras");
  await sinGuia(page);
});

test("el panel: la orden activa, con teclado, y una vez cada pantalla", async ({
  page,
}) => {
  await ingresar(page, admin);

  await page.goto(`/admin/ordenes/${orden.numero}`);
  await expect(globo(page)).toHaveAccessibleName("Ajustá cada producto");
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeFocused();
  expect(await axeDelGlobo(page)).toEqual([]);

  // Recién con el foco de vuelta en «Siguiente» el paso está armado para
  // recibir la tecla.
  for (const titulo of [
    "¿Te pidió algo más?",
    "Avisale los cambios",
    "Cuando se resuelve",
  ]) {
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(globo(page)).toHaveAccessibleName(titulo);
  }
  await page.keyboard.press("Escape");
  await expect(globo(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Ayuda" })).toBeFocused();

  await page.goto("/admin/ordenes/nueva");
  await expect(globo(page)).toHaveAccessibleName("Lo que vendiste");
  await page.keyboard.press("Escape");

  await page.goto(`/admin/productos/${productoId}`);
  await expect(globo(page)).toHaveAccessibleName("¿Cuánto podés vender?");
  await page.keyboard.press("Escape");

  await page.goto("/admin/devoluciones");
  await expect(globo(page)).toHaveAccessibleName("Cada una con su orden");
  await page.keyboard.press("Escape");

  await page.goto(`/admin/ordenes/${orden.numero}`);
  await sinGuia(page);
  await page.goto("/admin/devoluciones");
  await sinGuia(page);
});

test("en el panel, el globo pasa axe en oscuro y lleva su escala", async ({
  page,
}) => {
  await page.context().addInitScript(() => {
    localStorage.setItem("anavende:admin-theme", "dark");
  });
  await ingresar(page, admin);

  await page.goto(`/admin/productos/${productoId}`);
  await expect(globo(page)).toHaveAccessibleName("¿Cuánto podés vender?");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".driver-popover")).toHaveAttribute(
    "data-scale",
    "admin",
  );
  expect(await axeDelGlobo(page)).toEqual([]);
});
