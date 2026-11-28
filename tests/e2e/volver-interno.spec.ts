import { expect, test } from "./apoyo/test";

import { datosDePrueba } from "./apoyo/datos";

/**
 * La vuelta después de ingresar no saca de la tienda (`lib/redirect-target.ts`).
 * Cualquiera puede mandar un enlace a `/ingresar` con el `volver` que quiera,
 * y `//otro.com` empieza con `/`.
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
