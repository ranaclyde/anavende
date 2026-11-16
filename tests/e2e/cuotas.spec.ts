import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";
import { POR_PAGINA } from "@/modules/catalog/filtros-panel";

/**
 * Promociones de cuotas por medio de pago — F2.17, RF-40.
 *
 * La administradora carga una desde el panel, con su vista previa, y la ficha
 * la muestra debajo del precio. Con dos, una queda a la vista y la otra detrás
 * de «Ver más opciones». Una que pide un mínimo que el precio no alcanza no
 * aparece, y una desactivada tampoco.
 */

const datos = datosDePrueba();
const palabra = sufijo();
const goCuotas = `Go Cuotas ${palabra}`;
const naranja = `Naranja ${palabra}`;
let admin: Cuenta;
let producto: { id: string; slug: string };
let barato: { id: string; slug: string };

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const negro = await datos.unColor(`Negro ${palabra}`, "#111111");
  producto = await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "37000.00",
    colores: [negro],
    stock: 5,
  });
  barato = await datos.unProducto({
    nombre: `Pad ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "5000.00",
    colores: [negro],
    stock: 5,
  });
  await datos.unMedioDePago(goCuotas);
  const naranjaId = await datos.unMedioDePago(naranja);
  // La segunda, por la base: lo que se prueba de ella es cómo se muestra.
  await datos.sql`
    INSERT INTO payment_promotions
           (payment_method_id, installments, surcharge_pct, starts_on)
    VALUES (${naranjaId}, 3, 15,
            (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)`;
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/**
 * El medio se creó al final de la lista, así que está en la última página;
 * cuál es depende de cuántos haya en la base local.
 */
async function abrirPromociones(page: import("@playwright/test").Page) {
  const [{ n }] = await datos.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM payment_methods`;
  const ultima = Math.max(1, Math.ceil(n / POR_PAGINA));
  await page.goto(`/admin/catalogo/medios-de-pago?pagina=${ultima}`);
  await page
    .getByRole("button", { name: `Promociones de cuotas de ${goCuotas}` })
    .first()
    .click();
}

test("se carga en el panel y la ficha la muestra debajo del precio", async ({
  page,
}) => {
  await ingresar(page, admin);
  await abrirPromociones(page);

  const drawer = page.getByRole("dialog", { name: `Cuotas con ${goCuotas}` });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Todavía no cargaste ninguna")).toBeVisible();
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);

  await drawer.getByRole("button", { name: "Nueva promoción" }).click();
  const form = page.getByRole("dialog", { name: "Nueva promoción" });
  await form.getByLabel("Cuotas").fill("6");
  await form.getByLabel("Monto mínimo").fill("20.000");
  // La vista previa calcula sobre el mínimo: 20000 / 6 = 3333,333… → ,34.
  await expect(form.getByText("En un producto de $ 20.000,00")).toBeVisible();
  await expect(form.getByText(/6 cuotas de \$\s3\.333,34/)).toBeVisible();
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);

  // El fin antes del inicio lo dice en su campo.
  await form.getByLabel("Hasta").fill("2020-01-01");
  await form.getByRole("button", { name: "Crear" }).click();
  await expect(
    form.getByText("La fecha de fin no puede ser anterior a la de inicio."),
  ).toBeVisible();
  await form.getByLabel("Hasta").fill("");
  await form.getByRole("button", { name: "Crear" }).click();

  const lista = page.getByRole("dialog", { name: `Cuotas con ${goCuotas}` });
  await expect(
    lista.getByText("6 cuotas sin interés", { exact: true }),
  ).toBeVisible();
  await expect(lista.getByText("Vigente", { exact: true })).toBeVisible();
  await lista.getByRole("button", { name: "Cerrar" }).first().click();
  await expect(page.getByText("1 promoción vigente").first()).toBeVisible();

  // La ficha: la de 6 sin interés gana a la de 3 con recargo.
  await page.goto(`/productos/${producto.slug}`);
  await expect(
    page.getByText(/^Mismo precio en 6 cuotas de \$\s6\.166,67 con Go Cuotas/),
  ).toBeVisible();
  const mas = page.locator("summary", { hasText: "Ver más opciones (1)" });
  await expect(mas).toBeVisible();
  await expect(
    page.getByText(/3 cuotas de \$\s14\.183,34 con Naranja/),
  ).toBeHidden();
  await mas.click();
  await expect(
    page.getByText(/^3 cuotas de \$\s14\.183,34 con Naranja/),
  ).toBeVisible();
  // Con recargo, nunca «Mismo precio».
  await expect(page.getByText(/Mismo precio en 3 cuotas/)).toHaveCount(0);
  expect(await hallazgosDeAxe(page)).toEqual([]);

  // El de $ 5.000 no llega al mínimo de Go Cuotas: queda solo Naranja.
  await page.goto(`/productos/${barato.slug}`);
  await expect(
    page.getByText(/^3 cuotas de \$\s1\.916,67 con Naranja/),
  ).toBeVisible();
  await expect(page.getByText(/Go Cuotas/)).toHaveCount(0);
  await expect(page.getByText(/Ver más opciones/)).toHaveCount(0);

  // Desactivada, desaparece de la ficha.
  await abrirPromociones(page);
  await page
    .getByRole("button", { name: "Desactivar 6 cuotas sin interés" })
    .click();
  await expect(page.getByText("Desactivada", { exact: true })).toBeVisible();
  await page.goto(`/productos/${producto.slug}`);
  await expect(page.getByText(/Go Cuotas/)).toHaveCount(0);
  await expect(
    page.getByText(/^3 cuotas de \$\s14\.183,34 con Naranja/),
  ).toBeVisible();
});

test("el drawer pasa axe en el modo oscuro del panel", async ({ browser }) => {
  const contexto = await browser.newContext();
  await contexto.addInitScript(() => {
    localStorage.setItem("anavende:admin-theme", "dark");
  });
  const page = await contexto.newPage();
  await ingresar(page, admin);
  await abrirPromociones(page);
  await expect(
    page.getByRole("dialog", { name: `Cuotas con ${goCuotas}` }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);
  await page.getByRole("button", { name: "Nueva promoción" }).click();
  await page.waitForTimeout(500);
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);
  await contexto.close();
});
