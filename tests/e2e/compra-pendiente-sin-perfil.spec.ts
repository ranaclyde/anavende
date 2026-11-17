import { expect, test } from "./apoyo/test";

import { datosDePrueba, sufijo, type ProductoDePrueba } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * La compra pendiente de una cuenta sin perfil — F5.7, RF-06, RF-08, §13.4.
 *
 * Quien entra con Google tiene cuenta desde la vuelta del proveedor, pero
 * perfil recién en `/completar-perfil`. Si en ese rato abría una ficha, la
 * ficha decidía con la identidad sola: dibujaba «Agregá al carrito» y
 * retomaba la compra pendiente, las acciones la rechazaban por falta de
 * perfil, y leía «Necesitás iniciar sesión para hacer eso.» con el
 * encabezado diciendo «Ingresar».
 *
 * Lo que tiene que pasar ahora: la ficha la trata como sin sesión, igual que
 * el encabezado; «Iniciá sesión para comprar» la lleva a completar el perfil
 * **sin perder la vuelta**, y al terminar vuelve a la ficha y la compra se
 * retoma.
 *
 * Google no se puede recorrer en local. El estado se arma igual que como lo
 * deja: una cuenta con sesión abierta y sin fila en `user_profiles`.
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

  // Lo que deja la vuelta de Google: sesión abierta, perfil ninguno. El
  // carrito se va en cascada con el perfil.
  await datos.sql`DELETE FROM user_profiles WHERE id = ${cuenta.id}`;

  await page.goto(`/productos/${mouse.slug}`);

  // Como el encabezado: sin perfil no hay sesión para comprar.
  await expect(
    page.getByRole("button", { name: "Agregá al carrito" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Iniciá sesión para comprar" }).click();

  // `/ingresar` no la manda a «Mi cuenta»: va a completar el perfil y la
  // vuelta a la ficha viaja con ella.
  await page.waitForURL(/\/completar-perfil\?volver=/);
  expect(new URL(page.url()).searchParams.get("volver")).toContain(
    `/productos/${mouse.slug}`,
  );

  await page.getByLabel("Nombre").fill("Sin");
  await page.getByLabel("Apellido").fill("Perfil");
  await page.getByLabel("Teléfono").fill("2920 555555");
  await page.getByRole("button", { name: "Guardar y seguir" }).click();

  // De vuelta en la ficha, ya con perfil: la compra pendiente se retoma.
  await page.waitForURL((url) => url.pathname === `/productos/${mouse.slug}`);
  await expect(page.getByText("Listo, está en tu carrito.")).toBeVisible();
  await expect(page.getByText("Necesitás iniciar sesión")).toHaveCount(0);

  const [fila] = await datos.sql<{ quantity: number }[]>`
    SELECT ci.quantity
    FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
    WHERE c.user_id = ${cuenta.id}`;
  expect(fila?.quantity).toBe(1);
});
