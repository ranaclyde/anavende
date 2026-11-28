import { expect, test, type Page, type Request } from "./apoyo/test";

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
 * Aislamiento entre compradores (TS §13.8, §17.2 caso 6). **Bloqueante de la
 * Compuerta F10.** No hay RLS: el filtro por el comprador de la sesión,
 * escrito en cada consulta, es la única barrera entre los datos de uno y los
 * de otro.
 *
 * La compradora A intenta llegar a lo de B por las dos puertas que hay:
 *
 * - **Por la URL**, con el ID de B: tiene que ser 404, igual que algo que no
 *   existe.
 * - **Por las acciones**: se captura una llamada verdadera de A sobre lo
 *   suyo y **se repite cambiando el ID por el de B**. Se verifica en la base
 *   que lo de B quedó como estaba.
 *
 * Cada negativa va con su control (lo de A sí se ve, la acción sí cambió lo
 * de A): un 404 que también le saliera a A no probaría nada.
 *
 * El carrito y los favoritos se direccionan por variante y producto, no por
 * un ID propio: lo que se intenta es quitar algo que **B** tiene.
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
 * acciones contestan 200 aun cuando rechazan (`lib/action.ts`): se mira el
 * `ok: false` y, sobre todo, la base. Quitar del carrito o de favoritos algo
 * que no se tiene no es un error, y por eso esas repeticiones no esperan el
 * rechazo.
 */
async function repetir(
  pedido: Request,
  de: string,
  a: string,
  { rechazada = true } = {},
): Promise<void> {
  const cuerpo = pedido.postData() ?? "";
  expect(cuerpo, "el valor a cambiar viaja en el pedido").toContain(de);

  // La cookie de sesión la pone el contexto, como en el pedido original.
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

  await pagina.goto(`/mi-cuenta/direcciones/${a.direcciones[1]}`);
  const edicion = await capturar(() =>
    pagina.getByRole("button", { name: "Guardar dirección" }).click(),
  );
  await repetir(edicion, a.direcciones[1], b.direcciones[1]);

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

  // «Casa» ya no es la predeterminada, así que se puede eliminar.
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
