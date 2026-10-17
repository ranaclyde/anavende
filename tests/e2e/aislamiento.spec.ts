import { expect, test, type Page, type Request } from "@playwright/test";

import {
  armarEscenario,
  desarmarEscenario,
  estadoDeLaOrden,
  laDireccion,
  productosFavoritos,
  variantesEnElCarrito,
  type Escenario,
} from "./apoyo/compradores";

/**
 * F10.1 — Aislamiento entre compradores. TS §13.8, §17.2 caso 6, R13.
 *
 * **Bloqueante de la Compuerta F10.** No hay RLS (§13.8): el filtro por el
 * comprador de la sesión, escrito en cada consulta, es la única barrera entre
 * los datos de uno y los de otro. Este test es lo que comprueba que no tiene
 * agujeros.
 *
 * La compradora A tiene sesión e intenta llegar a lo de B de las dos formas
 * que existen:
 *
 * - **Por la dirección**, con el ID de B en la URL: la orden y la dirección.
 *   Tiene que ser 404, igual que algo que no existe.
 * - **Por las acciones**, que es la otra puerta: el carrito y los favoritos
 *   no tienen pantalla con ID, y las direcciones y la orden se modifican por
 *   acciones que reciben uno. Se hace lo que haría alguien que mira la red:
 *   **se captura una llamada verdadera de A sobre lo suyo y se repite
 *   cambiando el ID por el de B**. Lo que se verifica es la base: lo de B
 *   quedó como estaba.
 *
 * Cada negativa va con su control —lo propio de A sí se ve, y la acción
 * capturada sí cambió lo de A—: un 404 que también le saliera a A sobre lo
 * suyo no probaría nada.
 *
 * El carrito y los favoritos se direccionan por variante y por producto, no
 * por un ID propio (`modules/cart/actions.ts`, `modules/users/favoritos`):
 * «el carrito de otro» no se puede nombrar. Lo que sí se puede intentar es
 * quitar algo que **B** tiene, y eso es lo que se prueba.
 */

test.describe.configure({ mode: "serial" });

let e: Escenario;
let pagina: Page;

test.beforeAll(async ({ browser }) => {
  e = await armarEscenario();

  pagina = await (await browser.newContext()).newPage();
  await pagina.goto("/ingresar");
  await pagina.getByLabel("Email").fill(e.a.email);
  await pagina.getByLabel("Contraseña").fill(e.a.password);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
  await pagina.waitForURL((url) => !url.pathname.startsWith("/ingresar"));
});

test.afterAll(async () => {
  await pagina?.context().close();
  await desarmarEscenario();
});

/** Hace lo que dispara la acción y devuelve el pedido que salió. */
async function capturar(disparar: () => Promise<unknown>): Promise<Request> {
  const [pedido] = await Promise.all([
    pagina.waitForRequest(
      (r) => r.method() === "POST" && r.headers()["next-action"] !== undefined,
    ),
    disparar(),
  ]);
  await pedido.response();
  return pedido;
}

/**
 * El mismo pedido, con la misma sesión, cambiando un valor del cuerpo. Las
 * acciones contestan 200 aun cuando rechazan (`lib/action.ts`), así que lo
 * que se mira es el `ok: false` y, sobre todo, la base. Quitar del carrito o
 * de favoritos algo que no se tiene no es un error —no queda nada que
 * quitar—, y por eso esas dos repeticiones no esperan el rechazo.
 */
async function repetir(
  pedido: Request,
  de: string,
  a: string,
  { rechazada = true } = {},
): Promise<void> {
  const cuerpo = pedido.postData() ?? "";
  expect(cuerpo, "el valor a cambiar viaja en el pedido").toContain(de);

  // La sesión la pone el contexto, como en el pedido original.
  const {
    cookie,
    "content-length": largo,
    host,
    ...cabeceras
  } = await pedido.allHeaders();
  void [cookie, largo, host];

  const respuesta = await pagina.request.post(pedido.url(), {
    headers: cabeceras,
    data: cuerpo.replaceAll(de, a),
  });
  expect(respuesta.ok()).toBe(true);
  if (rechazada) expect(await respuesta.text()).toContain('"ok":false');
}

async function estado(ruta: string): Promise<number | undefined> {
  return (await pagina.goto(ruta))?.status();
}

test("la orden y la dirección de otro dan 404", async () => {
  const { a, b } = e;

  expect(await estado(`/orden/${a.orden.numero}`)).toBe(200);
  expect(await estado(`/orden/${b.orden.numero}`)).toBe(404);

  expect(await estado(`/mi-cuenta/compras/${a.orden.numero}`)).toBe(200);
  expect(await estado(`/mi-cuenta/compras/${b.orden.numero}`)).toBe(404);

  expect(await estado(`/mi-cuenta/direcciones/${a.direcciones[0]}`)).toBe(200);
  expect(await estado(`/mi-cuenta/direcciones/${b.direcciones[0]}`)).toBe(404);
});

test("el carrito y los favoritos muestran solo lo propio", async () => {
  const { compartido, soloDeB } = e;

  for (const ruta of ["/carrito", "/mi-cuenta/favoritos"]) {
    await pagina.goto(ruta);
    await expect(pagina.getByText(compartido.nombre).first()).toBeVisible();
    await expect(pagina.getByText(soloDeB.nombre)).toHaveCount(0);
  }

  // Y lo de B tampoco aparece en el listado de compras ni de direcciones.
  await pagina.goto("/mi-cuenta/compras");
  await expect(pagina.getByText(`#${e.a.orden.numero}`).first()).toBeVisible();
  await expect(pagina.getByText(`#${e.b.orden.numero}`)).toHaveCount(0);
});

test("no se edita, ni se predetermina, ni se elimina una dirección ajena", async () => {
  const { a, b } = e;
  const antes = [
    await laDireccion(b.direcciones[0]),
    await laDireccion(b.direcciones[1]),
  ];

  // Editar: se guarda la propia sin cambios y se repite sobre la de B.
  await pagina.goto(`/mi-cuenta/direcciones/${a.direcciones[1]}`);
  const edicion = await capturar(() =>
    pagina.getByRole("button", { name: "Guardar dirección" }).click(),
  );
  await repetir(edicion, a.direcciones[1], b.direcciones[1]);

  // Predeterminar: la de B que no lo es tiene que seguir sin serlo.
  await pagina.goto("/mi-cuenta/direcciones");
  const predeterminar = await capturar(() =>
    pagina
      .getByRole("button", { name: "Usar como predeterminada «Trabajo»" })
      .click(),
  );
  await expect
    .poll(async () => (await laDireccion(a.direcciones[1])).is_default)
    .toBe(true);
  await repetir(predeterminar, a.direcciones[1], b.direcciones[1]);

  // Eliminar: se elimina «Casa» de A, que ya no es la predeterminada.
  await pagina.getByRole("button", { name: "Eliminar «Casa»" }).click();
  const eliminacion = await capturar(() =>
    pagina
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar", exact: true })
      .click(),
  );
  await expect
    .poll(async () => (await laDireccion(a.direcciones[0])).deleted_at)
    .not.toBeNull();
  await repetir(eliminacion, a.direcciones[0], b.direcciones[0]);

  expect([
    await laDireccion(b.direcciones[0]),
    await laDireccion(b.direcciones[1]),
  ]).toEqual(antes);
});

test("no se cancela un pedido ajeno", async () => {
  const { a, b } = e;

  await pagina.goto(`/mi-cuenta/compras/${a.orden.numero}`);
  await pagina.getByRole("button", { name: "Cancelar el pedido" }).click();
  const cancelacion = await capturar(() =>
    pagina.getByRole("button", { name: "Sí, cancelarlo" }).click(),
  );
  await expect.poll(() => estadoDeLaOrden(a.orden.id)).toBe("cancelada");

  await repetir(
    cancelacion,
    `"numero":${a.orden.numero}`,
    `"numero":${b.orden.numero}`,
  );

  expect(await estadoDeLaOrden(b.orden.id)).toBe("activa");
});

test("quitar del carrito y de favoritos toca solo lo propio", async () => {
  const { a, b, compartido, soloDeB } = e;

  await pagina.goto("/carrito");
  const quitar = await capturar(() =>
    pagina
      .getByRole("button", { name: `Quitar ${compartido.nombre} del carrito` })
      .click(),
  );
  await expect
    .poll(() => variantesEnElCarrito(a.userId))
    .not.toContain(compartido.variantId);
  // Repetido con lo que solo tiene B. A no lo tiene, así que no hay nada que
  // quitar: la acción contesta bien y lo que dice si hubo fuga es la base.
  await repetir(quitar, compartido.variantId, soloDeB.variantId, {
    rechazada: false,
  });

  await pagina.goto("/mi-cuenta/favoritos");
  const desmarcar = await capturar(() =>
    pagina
      .getByRole("button", { name: `Quitar ${compartido.nombre} de favoritos` })
      .click(),
  );
  await expect
    .poll(() => productosFavoritos(a.userId))
    .not.toContain(compartido.productId);
  await repetir(desmarcar, compartido.productId, soloDeB.productId, {
    rechazada: false,
  });

  expect((await variantesEnElCarrito(b.userId)).sort()).toEqual(
    [compartido.variantId, soloDeB.variantId].sort(),
  );
  expect((await productosFavoritos(b.userId)).sort()).toEqual(
    [compartido.productId, soloDeB.productId].sort(),
  );
});
