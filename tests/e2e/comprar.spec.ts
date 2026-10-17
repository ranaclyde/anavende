import { expect, test } from "./apoyo/test";

import { enlaceDelEmail, vaciarBuzon } from "./apoyo/buzon";
import {
  datosDePrueba,
  sufijo,
  type Color,
  type ProductoDePrueba,
} from "./apoyo/datos";

/**
 * F10.2 — Registrarse, comprar y que el stock quede reservado. TS §17.2,
 * caso 2; FS RF-05, RF-08 a RF-12; TS §8.4.
 *
 * Es el camino que crea una orden desde la tienda, de punta a punta y sin
 * atajos: **la cuenta se crea por la pantalla de alta** y se confirma con el
 * enlace del email, que llega al buzón del stack local (`apoyo/buzon.ts`).
 * Una cuenta creada por la API se saltearía justo lo que una compradora nueva
 * tiene que atravesar antes de poder comprar.
 *
 * Lo que se verifica al final es la base, además de la pantalla: la orden
 * nace activa con lo que se vio en el resumen, **la variante elegida queda
 * con las unidades reservadas** y la otra no, y el carrito queda vacío.
 *
 * El aviso a la vendedora (E4) sale de verdad por Resend, a la casilla de
 * prueba (`casillaDeAvisosDePrueba`).
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
const email = `e2e-compra-${palabra}@ejemplo.test`;
let teclado: ProductoDePrueba;
let negro: Color;
let blanco: Color;

test.beforeAll(async () => {
  const marca = `Teclas ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Teclados ${palabra}`);
  blanco = await datos.unColor(`Blanco ${palabra}`, "#FFFFFF");
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

  await datos.casillaDeAvisosDePrueba();
});

test.afterAll(async () => {
  const [perfil] = await datos.sql<{ id: string }[]>`
    SELECT id FROM user_profiles WHERE email = ${email}`;
  if (perfil) datos.anotarUsuario(perfil.id);
  await vaciarBuzon(email);
  await datos.desarmar();
});

test("comprador se registra, compra y el stock queda reservado", async ({
  page,
}) => {
  // Alta.
  await page.goto("/registro");
  await page.getByLabel("Nombre").fill("Compradora");
  await page.getByLabel("Apellido").fill("De Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Teléfono").fill("2920 555555");
  await page.getByLabel("Contraseña").fill(`Prueba-${palabra}`);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(
    page.getByRole("heading", { name: "Revisá tu email" }),
  ).toBeVisible();

  // Confirmación: el enlace del email deja la sesión abierta.
  await page.goto(await enlaceDelEmail(email));
  await expect(page).toHaveURL(/\/mi-cuenta$/);

  // Carrito: dos del color que no es el primero.
  await page.goto(`/productos/${teclado.slug}?color=${negro.slug}`);
  await expect(page.getByRole("radio", { name: negro.nombre })).toBeChecked();
  await page.getByRole("button", { name: "Agregar uno" }).click();
  await page.getByRole("button", { name: "Agregá al carrito" }).click();
  await expect(page.getByText("Listo, tenés 2 en tu carrito.")).toBeVisible();

  await page.getByRole("link", { name: "Ver carrito" }).click();
  await expect(
    page.getByRole("spinbutton", { name: `Cantidad de ${teclado.nombre}` }),
  ).toHaveValue("2");
  await page.getByRole("link", { name: "Continuar con el pedido" }).click();

  // Checkout: envío a una dirección nueva, cargada ahí mismo.
  await expect(
    page.getByRole("heading", { level: 1, name: "Confirmá tu pedido" }),
  ).toBeVisible();
  const confirmar = page.getByRole("button", { name: "Confirmar pedido" });
  await expect(confirmar).toBeDisabled();

  await page.getByLabel("Nombre de la dirección").fill("Casa");
  await page.getByLabel("Calle").fill("Av. Siempreviva");
  await page.getByLabel("Altura").fill("742");
  await page.getByLabel("Localidad").selectOption("Viedma");
  await page.getByRole("button", { name: "Guardar dirección" }).click();

  const resumen = page.getByRole("region", { name: "Resumen" });
  await expect(
    resumen.getByText(`${negro.nombre} · 2 × $ 24.500,00`),
  ).toBeVisible();
  await expect(resumen.getByText("$ 49.000,00").last()).toBeVisible();

  await expect(confirmar).toBeEnabled();
  await confirmar.click();

  // Confirmación.
  await page.waitForURL(/\/orden\/\d+$/);
  const numero = new URL(page.url()).pathname.split("/").pop()!;

  // La orden aparece en su panel.
  await page.goto("/mi-cuenta/compras");
  await expect(page.getByText(`#${numero}`).first()).toBeVisible();

  // Y en la base, con el stock reservado sobre la variante elegida.
  const [orden] = await datos.sql<
    { status: string; total: string; email: string }[]
  >`
    SELECT status, total, customer_email AS email
      FROM orders WHERE order_number = ${numero}`;
  expect(orden).toEqual({
    status: "activa",
    total: "49000.00",
    email,
  });

  const elegida = teclado.variantes.find((v) => v.color.id === negro.id)!;
  const otra = teclado.variantes.find((v) => v.color.id === blanco.id)!;
  const stock = await datos.sql<
    { id: string; stock_total: number; reserved_stock: number }[]
  >`
    SELECT id, stock_total, reserved_stock FROM product_variants
     WHERE product_id = ${teclado.id}`;
  const de = (id: string) => stock.find((v) => v.id === id);
  expect(de(elegida.id)).toMatchObject({ stock_total: 5, reserved_stock: 2 });
  expect(de(otra.id)).toMatchObject({ stock_total: 5, reserved_stock: 0 });

  const [{ renglones }] = await datos.sql<{ renglones: number }[]>`
    SELECT count(*)::int AS renglones FROM cart_items i
      JOIN carts c ON c.id = i.cart_id
      JOIN user_profiles u ON u.id = c.user_id
     WHERE u.email = ${email}`;
  expect(renglones).toBe(0);
});
