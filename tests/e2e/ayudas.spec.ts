import { expect, test, type Page } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta, type Orden } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F6.6 — Las guías de la ficha, el checkout y «Mis compras». FS RF-36.
 * F6.7 — Las del panel: la orden, la orden manual, el producto y las
 * devoluciones. FS RF-37.
 *
 * Lo que se prueba es lo que hace que una guía no moleste: **aparece sola la
 * primera vez y nunca más**, se cierra de cualquier forma, el foco entra al
 * globo y vuelve a «Ver la guía» al cerrarla, y ese botón la reabre. Más axe
 * sobre el globo abierto, que es un diálogo que no está en `accesibilidad.spec`.
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

  // La guía de devoluciones necesita una: sobre una orden finalizada, como
  // las de verdad (RF-25).
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
 * axe sobre el globo, **con el fundido terminado**: a mitad de los 200 ms el
 * globo es semitransparente y axe mide el contraste contra lo que se ve a
 * través, que no es lo que lee nadie.
 */
async function axeDelGlobo(page: Page): Promise<string[]> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  return hallazgosDeAxe(page, ".driver-popover");
}

/**
 * Espera a que la pantalla esté hidratada sin abrir la guía. El botón existe
 * desde el servidor, así que verlo no alcanza: la guía se decide en un efecto,
 * después de hidratar, y eso no deja rastro en la pantalla cuando decide no
 * abrirse. Un segundo cubre de sobra ese margen en `next dev` ya compilado.
 */
async function sinGuia(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Ver la guía" })).toBeVisible();
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

  // Esc la cierra, cuenta como vista y devuelve el foco a quien la reabre.
  await page.keyboard.press("Escape");
  await expect(globo(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Ver la guía" })).toBeFocused();

  await page.reload();
  await sinGuia(page);

  // «Ver la guía» la vuelve a abrir desde el principio.
  await page.getByRole("button", { name: "Ver la guía" }).click();
  await expect(globo(page)).toHaveAccessibleName("Elegí tu color");

  // Hasta el final con «Siguiente» y «Listo».
  for (let i = 0; i < 4; i++) {
    const listo = page.getByRole("button", { name: "Listo" });
    if (await listo.isVisible()) break;
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  await expect(globo(page)).toHaveAccessibleName("Acá no se paga nada");
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(globo(page)).toBeHidden();
});

test("el globo entra a 320px sin desbordar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/productos/${slug}`);

  await expect(globo(page)).toBeVisible();
  const caja = await globo(page).boundingBox();
  expect(caja?.x).toBeGreaterThanOrEqual(0);
  expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(await axeDelGlobo(page)).toEqual([]);

  await page.getByRole("button", { name: "Cerrar la guía" }).click();
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

  // Vistas las tres, ninguna vuelve.
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

  // Los cuatro pasos con el teclado: el foco vuelve a «Siguiente» en cada
  // uno, y recién ahí el paso está armado para recibir la tecla.
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
  await expect(page.getByRole("button", { name: "Ver la guía" })).toBeFocused();

  await page.goto("/admin/ordenes/nueva");
  await expect(globo(page)).toHaveAccessibleName("Lo que vendiste");
  await page.keyboard.press("Escape");

  await page.goto(`/admin/productos/${productoId}`);
  await expect(globo(page)).toHaveAccessibleName("¿Cuánto podés vender?");
  await page.keyboard.press("Escape");

  await page.goto("/admin/devoluciones");
  await expect(globo(page)).toHaveAccessibleName("Cada una con su orden");
  await page.keyboard.press("Escape");

  // Vistas las cuatro, ninguna vuelve.
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
