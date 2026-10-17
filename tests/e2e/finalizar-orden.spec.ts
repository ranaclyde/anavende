import { expect, test } from "@playwright/test";

import {
  datosDePrueba,
  sufijo,
  type Cuenta,
  type Orden,
  type ProductoDePrueba,
} from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.2 — La administradora finaliza una orden y el stock se descuenta bien.
 * TS §17.2, caso 4; FS RF-23; TS §8.3.
 *
 * Una orden activa con dos renglones de colores distintos y cantidades
 * distintas —2 y 1—, con el stock reservado como lo deja el checkout. Con
 * cantidades iguales, un descuento que tomara la cantidad del renglón
 * equivocado pasaría igual.
 *
 * «Correctamente» es, en la base: `stock_total` baja en lo vendido, la
 * reserva se libera, el disponible no cambia —esas unidades ya estaban
 * apartadas— y cada variante tiene su asiento de `venta` en el libro (§8.3).
 * Y **un tercer color que no está en la orden queda igual**.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
const palabra = sufijo();
let admin: Cuenta;
let silla: ProductoDePrueba;
let orden: Orden;

test.beforeAll(async () => {
  const marca = `Asientos ${palabra}`;
  const marcaId = await datos.unaMarca(marca);
  const categoriaId = await datos.unaCategoria(`Sillas ${palabra}`);
  const colores = [
    await datos.unColor(`Gris ${palabra}`, "#888888"),
    await datos.unColor(`Azul ${palabra}`, "#2244AA"),
    await datos.unColor(`Ocre ${palabra}`, "#CC9933"),
  ];
  silla = await datos.unProducto({
    nombre: `Silla ${palabra}`,
    marca,
    marcaId,
    categoriaId,
    precio: "90000.00",
    colores,
    stock: 5,
  });

  admin = await datos.unaCuenta("Ana", "admin");
  const compradora = await datos.unaCuenta("Compradora");
  const [gris, azul] = silla.variantes;
  orden = await datos.unaOrden(compradora, [
    { producto: silla, variante: gris, cantidad: 2, precio: "90000.00" },
    { producto: silla, variante: azul, cantidad: 1, precio: "90000.00" },
  ]);
});

test.afterAll(async () => {
  await datos.desarmar();
});

async function stock() {
  const filas = await datos.sql<
    { id: string; stock_total: number; reserved_stock: number }[]
  >`
    SELECT id, stock_total, reserved_stock FROM product_variants
     WHERE product_id = ${silla.id}`;
  return Object.fromEntries(
    filas.map((f) => [
      f.id,
      { total: f.stock_total, reservado: f.reserved_stock },
    ]),
  );
}

test("la administradora finaliza una orden y el stock se descuenta", async ({
  page,
}) => {
  const [gris, azul, ocre] = silla.variantes;

  expect(await stock()).toEqual({
    [gris.id]: { total: 5, reservado: 2 },
    [azul.id]: { total: 5, reservado: 1 },
    [ocre.id]: { total: 5, reservado: 0 },
  });

  await ingresar(page, admin);
  await page.goto(`/admin/ordenes/${orden.numero}`);
  await expect(
    page.getByRole("heading", { level: 1, name: `Orden #${orden.numero}` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const dialogo = page.getByRole("dialog", {
    name: `Finalizar la orden #${orden.numero}`,
  });
  // Antes de confirmar dice qué se va a descontar.
  await expect(dialogo.getByRole("listitem")).toHaveCount(2);
  await dialogo.getByRole("button", { name: "Finalizar la orden" }).click();
  await expect(dialogo).toBeHidden();

  await expect(page.getByText("Finalizada").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finalizar", exact: true }),
  ).toHaveCount(0);

  // En la base.
  const [{ status }] = await datos.sql<{ status: string }[]>`
    SELECT status FROM orders WHERE id = ${orden.id}`;
  expect(status).toBe("finalizada");

  expect(await stock()).toEqual({
    [gris.id]: { total: 3, reservado: 0 },
    [azul.id]: { total: 4, reservado: 0 },
    [ocre.id]: { total: 5, reservado: 0 },
  });

  const asientos = await datos.sql<{ variant_id: string; quantity: number }[]>`
    SELECT variant_id, quantity FROM stock_movements
     WHERE order_id = ${orden.id} AND type = 'venta'`;
  expect(
    Object.fromEntries(asientos.map((a) => [a.variant_id, a.quantity])),
  ).toEqual({ [gris.id]: -2, [azul.id]: -1 });
});
