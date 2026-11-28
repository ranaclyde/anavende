import type { Page } from "@playwright/test";

import type { Cuenta } from "./datos";

/**
 * Entra por `/ingresar` con la sesión real de la aplicación. Espera solo a
 * salir de esa pantalla: la administradora y la compradora caen en lugares
 * distintos.
 */
export async function ingresar(page: Page, cuenta: Cuenta): Promise<void> {
  await page.goto("/ingresar");
  await page.getByLabel("Email").fill(cuenta.email);
  await page.getByLabel("Contraseña").fill(cuenta.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/ingresar"));
}
