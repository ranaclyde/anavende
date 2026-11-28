import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type ProductoDePrueba } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * Quien entra con Google tiene sesión desde la vuelta del proveedor, pero
 * perfil recién en `/completar-perfil`. Si la ficha decidiera solo con la
 * sesión, ofrecería comprar y las acciones lo rechazarían por falta de
 * perfil. Tiene que tratarla como sin sesión, igual que el encabezado, y
 * mandarla a completar el perfil **sin perder la vuelta**.
 *
 * Google no se recorre en local: el estado se arma como lo deja, con sesión
 * abierta y sin fila en `user_profiles`.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
let mouse: ProductoDePrueba;

test.beforeAll(async () => {
  const marca = `Ratones ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Mouses ${palabra}`);
  const negro = await datos.unColor(`Negro ${palabra}`, "#111111");

  mouse = await datos.unProducto({
    nombre: `Mouse ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "15000.00",
    colores: [negro],
    stock: 5,
  });
});

test.afterAll(async () => {
  await datos.desarmar();
});

test("sin perfil, la ficha manda a completarlo y la compra se retoma", async ({
  page,
}) => {
  const cuenta = await datos.unaCuenta(`Sinperfil${palabra}`);
  await ingresar(page, cuenta);

  // El carrito se va en cascada con el perfil.
  await datos.sql`DELETE FROM user_profiles WHERE id = ${cuenta.id}`;

  await page.goto(`/productos/${mouse.slug}`);

  await expect(
    page.getByRole("button", { name: "Agregá al carrito" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Iniciá sesión para comprar" }).click();

  await page.waitForURL(/\/completar-perfil\?volver=/);
  expect(new URL(page.url()).searchParams.get("volver")).toContain(
    `/productos/${mouse.slug}`,
  );

  await page.getByLabel("Nombre").fill("Sin");
  await page.getByLabel("Apellido").fill("Perfil");
  await page.getByLabel("Teléfono").fill("2920 555555");
  await page.getByRole("button", { name: "Guardar y seguir" }).click();

  await page.waitForURL((url) => url.pathname === `/productos/${mouse.slug}`);
  await expect(page.getByText("Listo, está en tu carrito.")).toBeVisible();
  await expect(page.getByText("Necesitás iniciar sesión")).toHaveCount(0);

  const [fila] = await datos.sql<{ quantity: number }[]>`
    SELECT ci.quantity
    FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${cuenta.id}`;
  expect(fila?.quantity).toBe(1);
});
