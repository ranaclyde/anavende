import { expect, test } from "./apoyo/test";

import { datosDePrueba } from "./apoyo/datos";

/**
 * La vuelta después de ingresar no saca de la tienda — §16, `lib/destino.ts`.
 *
 * `volver` viaja en la dirección: cualquiera puede mandar un enlace a nuestro
 * `/ingresar` con el destino que quiera. `//otro.com` empieza con `/` y, hasta
 * el 2026-11-17, el formulario de ingreso lo aceptaba: después de escribir la
 * contraseña en la tienda, la persona terminaba en otro sitio.
 */

const datos = datosDePrueba();

test.afterAll(async () => {
  await datos.desarmar();
});

for (const volver of ["//example.com", "/\\example.com"]) {
  test(`ingresar con volver=${volver} se queda en la tienda`, async ({
    page,
    baseURL,
  }) => {
    const cuenta = await datos.unaCuenta("Volver");

    await page.goto(`/ingresar?volver=${encodeURIComponent(volver)}`);
    await page.getByLabel("Email").fill(cuenta.email);
    await page.getByLabel("Contraseña").fill(cuenta.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/ingresar"));

    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
  });
}
