import { expect, test, type Locator, type Page } from "./apoyo/test";

import {
  datosDePrueba,
  sufijo,
  type Color,
  type Cuenta,
  type ProductoDePrueba,
} from "./apoyo/datos";

/**
 * F10.3 — Una compra entera sin mouse. DESIGN-REFERENCE §9: «todo flujo de
 * compra completable sin mouse», y el foco visible en todo lo que lo toma.
 *
 * Se entra, se elige el color, la cantidad, se agrega, se va al carrito, al
 * checkout y se confirma **solo con Tab, flechas, Enter y espacio**: el test
 * no hace un solo `click()`. Y en cada parada del Tab se mira que el foco se
 * vea —el anillo de `--shadow-focus` o un contorno—, que es lo que axe no
 * puede revisar.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
let compradora: Cuenta;
let teclado: ProductoDePrueba;
let negro: Color;

test.beforeAll(async () => {
  const palabra = sufijo();
  const marca = `Teclas ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Teclados ${palabra}`);
  const blanco = await datos.unColor(`Blanco ${palabra}`, "#FFFFFF");
  negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  teclado = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "24500.00",
    colores: [blanco, negro],
    stock: 5,
  });

  compradora = await datos.unaCuenta("Compradora");
  await datos.sql`
    INSERT INTO addresses
      (user_id, label, recipient_name, phone, street, number,
       city, province, postal_code, is_default)
    VALUES
      (${compradora.id}, 'Casa', 'Compradora De Prueba', '+5492920555555',
       'Av. Siempreviva', '742', 'Viedma', 'Río Negro', '8500', true)`;
  await datos.casillaDeAvisosDePrueba();
});

test.afterAll(async () => {
  await datos.desarmar();
});

/** Las paradas del Tab donde el foco no se ve, para el informe final. */
const sinFoco: string[] = [];

/**
 * Si el elemento con foco se distingue: el anillo (`box-shadow`) o un
 * contorno de color. El contorno transparente de `globals.css` no cuenta:
 * existe para el alto contraste de Windows, y en la pantalla no se ve.
 *
 * Un control escondido —un radio dentro de su tarjeta— pinta el foco en la
 * tarjeta, así que también se miran los dos de arriba.
 */
async function seVeElFoco(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const activo = document.activeElement as HTMLElement | null;
    if (!activo || activo === document.body) return null;
    // Turnstile es de Cloudflare: su iframe vive en un shadow DOM cerrado, y
    // desde afuera el foco se ve como un `<div>` vacío al lado del token.
    if (activo.parentElement?.querySelector('[name="cf-turnstile-response"]'))
      return null;

    const marcado = (el: Element) => {
      const s = getComputedStyle(el);
      const contorno =
        s.outlineStyle !== "none" &&
        s.outlineWidth !== "0px" &&
        !/rgba\(0, 0, 0, 0\)|transparent/.test(s.outlineColor);
      return s.boxShadow !== "none" || contorno;
    };

    let el: Element | null = activo;
    for (let i = 0; el && i < 3; i++, el = el.parentElement) {
      if (marcado(el)) return null;
    }
    const nombre =
      activo.getAttribute("aria-label") ??
      activo.textContent?.trim().slice(0, 40) ??
      "";
    return `${location.pathname}: <${activo.tagName.toLowerCase()}> «${nombre}»`;
  });
}

/** Tab hasta que el foco llegue a `objetivo`, revisando cada parada. */
async function tabularHasta(page: Page, objetivo: Locator, limite = 80) {
  for (let i = 0; i < limite; i++) {
    await page.keyboard.press("Tab");
    const falta = await seVeElFoco(page);
    if (falta && !sinFoco.includes(falta)) sinFoco.push(falta);
    if (await objetivo.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error(`El Tab no llegó en ${limite} pasos a ${objetivo}`);
}

test("una compra entera con el teclado, con el foco a la vista", async ({
  page,
}) => {
  // Ingreso.
  await page.goto("/ingresar");
  await tabularHasta(page, page.getByLabel("Email"));
  await page.keyboard.type(compradora.email);
  await tabularHasta(page, page.getByLabel("Contraseña"));
  await page.keyboard.type(compradora.password);
  const ingresar = page.getByRole("button", { name: "Ingresar" });
  await expect(ingresar).toBeEnabled(); // espera el token de Turnstile
  await tabularHasta(page, ingresar);
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/ingresar"));

  // La ficha: el segundo color con las flechas, y dos unidades.
  await page.goto(`/productos/${teclado.slug}`);
  const primero = page.getByRole("radio", {
    name: teclado.variantes[0].color.nombre,
  });
  await expect(primero).toBeChecked();
  await tabularHasta(page, primero);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: negro.nombre })).toBeChecked();

  await tabularHasta(page, page.getByRole("button", { name: "Agregar uno" }));
  await page.keyboard.press("Enter");
  await tabularHasta(
    page,
    page.getByRole("button", { name: "Agregá al carrito" }),
  );
  await page.keyboard.press("Enter");
  await expect(page.getByText("Listo, tenés 2 en tu carrito.")).toBeVisible();

  await tabularHasta(page, page.getByRole("link", { name: "Ver carrito" }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/carrito$/);

  // El carrito.
  const continuar = page.getByRole("link", { name: "Continuar con el pedido" });
  await tabularHasta(page, continuar);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/checkout$/);

  // El checkout, con la dirección guardada.
  const confirmar = page.getByRole("button", { name: "Confirmar pedido" });
  await expect(confirmar).toBeEnabled();
  await tabularHasta(page, confirmar);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/orden\/\d+$/);

  const numero = new URL(page.url()).pathname.split("/").pop()!;
  const [orden] = await datos.sql<{ total: string }[]>`
    SELECT total FROM orders WHERE order_number = ${numero}`;
  expect(orden.total).toBe("49000.00");

  expect(sinFoco, "paradas del Tab sin foco visible").toEqual([]);
});
