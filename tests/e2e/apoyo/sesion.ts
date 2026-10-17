import type { Page } from "@playwright/test";

import type { Cuenta } from "./datos";

/**
 * Entra por `/ingresar`, como una persona: la sesión es la de la aplicación
 * y no una simulada. No espera a ningún destino en particular —la
 * administradora y la compradora caen en lugares distintos—, solo a salir de
 * la pantalla de ingreso.
 */
export async function ingresar(page: Page, cuenta: Cuenta): Promise<void> {
  await page.goto("/ingresar");
  await page.getByLabel("Email").fill(cuenta.email);
  await page.getByLabel("Contraseña").fill(cuenta.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/ingresar"));
}
