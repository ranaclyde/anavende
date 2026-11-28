import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";
import { POR_PAGINA } from "@/modules/catalog/filtros-panel";

/** Promociones de cuotas por medio de pago (RF-40). */

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
  // La segunda, por la base: de ella se prueba solo cómo se muestra.
  await datos.sql`
    INSERT INTO payment_promotions
           (payment_method_id, plan_name, installments, surcharge_pct,
            starts_on)
    VALUES (${naranjaId}, 'Plan Z', 3, 15,
            (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)`;
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

/**
 * El medio se creó al final de la lista: está en la última página, que
 * depende de cuántos haya en la base local.
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
  await form.getByLabel("Cuotas", { exact: true }).fill("6");
  await form.getByLabel("Monto mínimo").fill("20.000");
  // La vista previa calcula sobre el mínimo: 20000 / 6 = 3333,333… → ,34.
  await expect(form.getByText("En un producto de $ 20.000,00")).toBeVisible();
  await expect(form.getByText(/6 cuotas de \$\s3\.333,34/)).toBeVisible();
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);

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

  // La de 6 sin interés gana a la de 3 con recargo.
  await page.goto(`/productos/${producto.slug}`);
  await expect(
    page.getByText(/^Mismo precio en 6 cuotas de \$\s6\.166,67 con Go Cuotas/),
  ).toBeVisible();
  const naranjaEnLaFicha = /^3 cuotas de \$\s14\.183,34 con Plan Z de Naranja/;
  await expect(page.getByText(naranjaEnLaFicha)).toHaveCount(0);

  await page.getByRole("button", { name: "Ver otras opciones" }).click();
  const modal = page.getByRole("dialog", { name: "Cuotas para este producto" });
  await expect(modal).toBeVisible();
  // Solo las de esta prueba: la base local puede tener otras cargadas a mano.
  await expect(
    modal.getByRole("listitem").filter({ hasText: palabra }),
  ).toHaveText([
    /6 cuotas de \$\s6\.166,67\s*con Go Cuotas/,
    /3 cuotas de \$\s14\.183,34\s*con Plan Z de Naranja/,
  ]);
  await expect(
    modal.getByRole("heading", { name: "Mismo precio" }),
  ).toBeVisible();
  await expect(
    modal.getByRole("heading", { name: "Con recargo" }),
  ).toBeVisible();
  // A mitad del fundido de entrada, axe mide colores que nadie llega a leer.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  expect(await hallazgosDeAxe(page, '[role="dialog"]')).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  expect(await hallazgosDeAxe(page)).toEqual([]);

  // El de $ 5.000 no llega al mínimo de Go Cuotas. Solo si la base local no
  // tiene otras promociones vigentes: también le aplicarían a este producto.
  const [{ ajenas }] = await datos.sql<{ ajenas: number }[]>`
    SELECT count(*)::int AS ajenas
      FROM payment_promotions pp
      JOIN payment_methods pm ON pm.id = pp.payment_method_id
     WHERE pp.is_active AND pm.is_active
       AND pm.name NOT IN (${goCuotas}, ${naranja})`;
  if (ajenas === 0) {
    await page.goto(`/productos/${barato.slug}`);
    await expect(
      page.getByText(/^3 cuotas de \$\s1\.916,67 con Plan Z de Naranja/),
    ).toBeVisible();
    await expect(page.getByText(/Go Cuotas/)).toHaveCount(0);
    await expect(page.getByText("Ver otras opciones")).toHaveCount(0);
  } else {
    test.info().annotations.push({
      type: "salteado",
      description: `«Sin enlace con una sola»: hay ${ajenas} promociones ajenas en la base local`,
    });
  }

  await abrirPromociones(page);
  await page
    .getByRole("button", { name: "Desactivar 6 cuotas sin interés" })
    .click();
  await expect(page.getByText("Desactivada", { exact: true })).toBeVisible();
  await page.goto(`/productos/${producto.slug}`);
  await expect(page.getByText(/Go Cuotas/)).toHaveCount(0);
  // Si no hay una ajena que le gane.
  if (ajenas === 0) {
    await expect(page.getByText(naranjaEnLaFicha)).toBeVisible();
  }
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
