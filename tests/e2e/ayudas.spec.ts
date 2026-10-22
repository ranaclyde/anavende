import { expect, test, type Page } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta, type Orden } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F6.6 — Las guías de la ficha, el checkout y «Mis compras». FS RF-36.
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
let compradora: Cuenta;
let orden: Orden;

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

  compradora = await datos.unaCuenta("Compradora");
  orden = await datos.unaOrden(compradora, [
    {
      variante: teclado.variantes[0],
      producto: teclado,
      cantidad: 1,
      precio: "24500.00",
    },
  ]);

  // El checkout sin nada en el carrito vuelve al carrito.
  const [carrito] = await datos.sql<{ id: string }[]>`
    INSERT INTO carts (user_id) VALUES (${compradora.id}) RETURNING id`;
  await datos.sql`
    INSERT INTO cart_items (cart_id, variant_id, quantity, last_seen_price)
    VALUES (${carrito.id}, ${teclado.variantes[1].id}, 1, '24500.00')`;
});

test.afterAll(async () => {
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
  await expect(globo(page)).toHaveAccessibleName("Elegí el color");
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
  await expect(globo(page)).toHaveAccessibleName("Elegí el color");

  // Hasta el final con «Siguiente» y «Listo».
  for (let i = 0; i < 4; i++) {
    const listo = page.getByRole("button", { name: "Listo" });
    if (await listo.isVisible()) break;
    await page.getByRole("button", { name: "Siguiente" }).click();
  }
  await expect(globo(page)).toHaveAccessibleName("Acá no se paga");
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
  await expect(globo(page)).toHaveAccessibleName("Cómo lo recibís");
  await page.getByRole("button", { name: "Cerrar la guía" }).click();
  await expect(globo(page)).toBeHidden();

  await page.goto("/mi-cuenta/compras");
  await expect(globo(page)).toHaveAccessibleName("Tus pedidos");
  await page.keyboard.press("Escape");

  await page.goto(`/mi-cuenta/compras/${orden.numero}`);
  await expect(globo(page)).toHaveAccessibleName(
    "Tu pedido está en preparación",
  );
  expect(await axeDelGlobo(page)).toEqual([]);
  await page.keyboard.press("Escape");

  // Vistas las tres, ninguna vuelve.
  await page.goto("/checkout");
  await sinGuia(page);
  await page.goto("/mi-cuenta/compras");
  await sinGuia(page);
});
