import { expect, test } from "./apoyo/test";

import { hallazgosDeAxe } from "./apoyo/accesibilidad";
import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Los listados del panel dicen qué tramo se está viendo: «Del 1 al 40 de 45
 * productos» (pedido del 2026-11-03). Con una sola página la paginación no se
 * dibuja, y eso no cambió.
 *
 * Se prueba en productos, filtrado por una marca propia del test, para que el
 * total sea exacto aunque la base tenga otros productos.
 */

const CUANTOS = 45;

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let marcaId: string;
let soloUno: string;

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Categoria ${palabra}`);
  const colores = [await datos.unColor(`Negro ${palabra}`, "#111111")];
  for (let i = 1; i <= CUANTOS; i++) {
    await datos.unProducto({
      nombre: `Mouse ${palabra} ${String(i).padStart(2, "0")}`,
      marca,
      marcaId,
      categoriaId,
      precio: "12000.00",
      colores,
      stock: 3,
    });
  }
  // Una marca con un solo producto: una página, sin paginación.
  const otra = `Otra ${palabra}`;
  soloUno = await datos.unaMarca(otra);
  await datos.unProducto({
    nombre: `Teclado ${palabra}`,
    marca: otra,
    marcaId: soloUno,
    categoriaId,
    precio: "24500.00",
    colores,
    stock: 3,
  });
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("la paginación dice qué tramo se ve y de cuántos", async ({ page }) => {
  await ingresar(page, admin);
  await page.goto(`/admin/productos?marca=${marcaId}`);

  const paginacion = page.getByRole("navigation", { name: "Paginación" });
  await expect(paginacion).toContainText(`Del 1 al 40 de ${CUANTOS} productos`);
  await expect(paginacion).not.toContainText("Página 1 de");
  // En la primera no hay «Anterior»: el tramo ya dice que es el principio.
  await expect(paginacion.getByRole("link", { name: /Anterior/ })).toHaveCount(
    0,
  );
  if (process.env.CAPTURA) {
    await paginacion.scrollIntoViewIfNeeded();
    await page.screenshot({ path: process.env.CAPTURA });
  }

  await paginacion.getByRole("link", { name: /Siguiente/ }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(paginacion).toContainText(
    `Del 41 al ${CUANTOS} de ${CUANTOS} productos`,
  );
  await expect(paginacion.getByRole("link", { name: /Siguiente/ })).toHaveCount(
    0,
  );
  await expect(
    paginacion.getByRole("link", { name: /Anterior/ }),
  ).toBeVisible();
  // Axe sobre la paginación dibujada: en `accesibilidad.spec.ts` aparece o no
  // según cuántas filas tenga la base ese día.
  expect(await hallazgosDeAxe(page, 'nav[aria-label="Paginación"]')).toEqual(
    [],
  );

  // Una sola página: no se dibuja nada.
  await page.goto(`/admin/productos?marca=${soloUno}`);
  await expect(
    page.getByRole("link", { name: `Teclado ${palabra}`, exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Paginación" }),
  ).toHaveCount(0);
});

test("a 320px, las tarjetas y la paginación no ensanchan la página", async ({
  page,
}) => {
  // `accesibilidad.spec.ts` mide los 320px solo en la tienda. En el panel, la
  // fila de «Reponer» y los cuatro íconos ensanchaba cada tarjeta y se cortaba
  // el borrar (2026-11-03).
  await page.setViewportSize({ width: 390, height: 800 });
  await ingresar(page, admin);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/admin/productos?marca=${marcaId}`);
  const tarjeta = page.locator("li.rounded-panel-card").first();
  await expect(tarjeta).toBeVisible();

  const medida = await tarjeta.evaluate((li) => {
    const caja = li.getBoundingClientRect();
    return {
      sobra: document.documentElement.scrollWidth - window.innerWidth,
      afuera: [...li.querySelectorAll("*")].filter(
        (e) => e.getBoundingClientRect().right > caja.right + 0.5,
      ).length,
    };
  });
  expect(medida).toEqual({ sobra: 0, afuera: 0 });
  await expect(
    tarjeta.getByRole("button", { name: /^Borrar/ }),
  ).toBeInViewport();
});
