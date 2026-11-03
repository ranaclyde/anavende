import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type ProductoDePrueba } from "./apoyo/datos";

/**
 * La descripción larga de la ficha se pliega con «Mostrar más»; la corta se
 * muestra entera y sin botón (pedido del 2026-11-03).
 */

const datos = datosDePrueba();
const palabra = sufijo();
let larga: ProductoDePrueba;
let corta: ProductoDePrueba;

const PARRAFO =
  "Diseño ergonómico con material de alta calidad. Los botones responden con fluidez y el cable trenzado aguanta el uso de todos los días sin enredarse.";

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const color = await datos.unColor(`Negro ${palabra}`, "#111111");
  const base = { marca, marcaId, categoriaId, precio: "24500.00", stock: 5 };

  larga = await datos.unProducto({
    ...base,
    nombre: `Joystick ${palabra}`,
    colores: [color],
  });
  corta = await datos.unProducto({
    ...base,
    nombre: `Cable ${palabra}`,
    colores: [color],
  });

  const textoLargo = [
    PARRAFO,
    "## Qué trae",
    "- Cable USB-C\n- Manual\n- Funda",
    PARRAFO,
    PARRAFO,
    `Último renglón ${palabra}.`,
  ].join("\n\n");
  await datos.sql`UPDATE products SET description = ${textoLargo} WHERE id = ${larga.id}`;
  await datos.sql`UPDATE products SET description = ${"Cable de un metro."} WHERE id = ${corta.id}`;
});

test.afterAll(async () => {
  await datos.desarmar();
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("anavende:ayudas:v1", JSON.stringify(["ficha"])),
  );
});

test("la descripción larga se pliega y se despliega", async ({ page }) => {
  await page.goto(`/productos/${larga.slug}`);
  const seccion = page.getByRole("region", { name: "Sobre el producto" });
  const mas = seccion.getByRole("button", { name: "Mostrar más" });

  await expect(mas).toHaveAttribute("aria-expanded", "false");
  const ultimo = seccion.getByText(`Último renglón ${palabra}.`);
  // Recortado, no sacado: está en la página pero fuera de la caja.
  await expect(ultimo).toBeAttached();
  const caja = page.locator(`#${await mas.getAttribute("aria-controls")}`);
  const plegada = await caja.evaluate((n) => n.getBoundingClientRect().height);
  expect(plegada).toBeLessThanOrEqual(161);

  if (process.env.CAPTURA) {
    await mas.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.CAPTURA}-plegada.png` });
  }

  await mas.click();
  const menos = seccion.getByRole("button", { name: "Mostrar menos" });
  await expect(menos).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() => caja.evaluate((n) => n.getBoundingClientRect().height))
    .toBeGreaterThan(plegada + 80);

  if (process.env.CAPTURA) {
    await page.waitForTimeout(400);
    await menos.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.CAPTURA}-abierta.png` });
  }

  await menos.click();
  await expect(mas).toBeFocused();
  await expect(mas).toHaveAttribute("aria-expanded", "false");
});

test("plegada, en el teléfono, pasa axe y no ensancha la página", async ({
  page,
}) => {
  // La ficha de `accesibilidad.spec.ts` tiene una descripción corta y nunca
  // muestra el botón: se revisa acá, a 320px, que es el ancho más angosto
  // que se pide.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/productos/${larga.slug}`);
  const seccion = page.getByRole("region", { name: "Sobre el producto" });
  await expect(
    seccion.getByRole("button", { name: "Mostrar más" }),
  ).toBeVisible();

  expect(
    await hallazgosDeAxe(page, "section[aria-labelledby=descripcion]"),
  ).toEqual([]);
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});

test("la descripción corta se ve entera, sin botón", async ({ page }) => {
  await page.goto(`/productos/${corta.slug}`);
  const seccion = page.getByRole("region", { name: "Sobre el producto" });
  await expect(seccion.getByText("Cable de un metro.")).toBeVisible();
  // Se espera a que haya medido: sin esto, el botón todavía no existiría
  // por no haber hidratado, y el test pasaría por el motivo equivocado.
  await page.waitForLoadState("networkidle");
  await expect(seccion.getByRole("button", { name: /Mostrar/ })).toHaveCount(0);
});
