import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F3.11: el texto de una categoría se carga en el panel y sale en su página,
 * debajo del título y en la descripción para Google.
 */

const datos = datosDePrueba();
const palabra = sufijo();
// Empieza con un número para quedar en la primera página del listado, que
// va por nombre.
const nombre = `0 Rubro ${palabra}`;
const texto = `Con y sin cable, para jugar y para trabajar ${palabra}.`;
let admin: Cuenta;
let slug: string;

test.beforeAll(async () => {
  const marca = `Marca ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(nombre);
  slug = await datos.slugDeCategoria(categoriaId);
  await datos.unProducto({
    nombre: `Auricular ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "18900.00",
    colores: [await datos.unColor(`Negro ${palabra}`, "#111111")],
    stock: 3,
  });
  admin = await datos.unaCuenta("Ana", "admin");
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("el texto se carga en el panel y sale en la página de la categoría", async ({
  page,
}) => {
  // Sin texto, la página dice la frase de siempre.
  await page.goto(`/categorias/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nombre);
  await expect(page.getByText("Periféricos y accesorios.")).toBeVisible();

  await ingresar(page, admin);
  await page.goto("/admin/catalogo/categorias");
  await page.getByRole("button", { name: `Editar ${nombre}` }).click();
  await page
    .getByRole("textbox", { name: "Texto de la página (opcional)" })
    .fill(texto);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText(`Guardaste la categoría «${nombre}».`),
  ).toBeVisible();

  // Al volver a abrirla, el texto está.
  await page.getByRole("button", { name: `Editar ${nombre}` }).click();
  await expect(
    page.getByRole("textbox", { name: "Texto de la página (opcional)" }),
  ).toHaveValue(texto);

  await page.goto(`/categorias/${slug}`);
  await expect(page.getByText(texto)).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    texto,
  );
});
