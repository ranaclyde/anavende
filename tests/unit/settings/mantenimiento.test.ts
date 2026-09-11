import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { db } from "@/db";
import {
  estaEnMantenimiento,
  olvidarElInterruptor,
  pasaSiempre,
  puedeVerLaTiendaCerrada,
} from "@/modules/settings/mantenimiento";
import { elModoMantenimiento } from "@/modules/settings/queries";
import { configuracionDelSitio } from "@/modules/settings/schemas";
import {
  escribirElModoMantenimiento,
  escribirLaConfiguracion,
} from "@/modules/settings/service";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F2.7b — el modo mantenimiento.
 *
 * Como `configuracion.test.ts`, escribe de verdad y sin transacción revertida:
 * lo que se prueba son funciones de la aplicación que abren su propia conexión
 * por el pool. La fila de configuración que hubiera se guarda y se repone.
 *
 * Lo que NO se prueba acá es el proxy entero —el 503, el `Retry-After`, la
 * reescritura—: eso necesita un servidor de Next andando, y se comprueba con
 * `curl` contra `next dev` y después contra producción. Acá está todo lo que
 * el proxy decide, que es lo que se puede equivocar en silencio.
 */

describe("qué rutas pasan con la tienda cerrada", () => {
  test.each([
    "/admin",
    "/admin/configuracion",
    "/ingresar",
    "/recuperar",
    "/recuperar/nueva-contrasena",
    "/completar-perfil",
    "/error",
    "/api/salud",
    "/api/auth/confirmar",
    "/emails/verificacion.html",
    "/marca/logo.png",
    "/mantenimiento",
  ])("«%s» pasa siempre", (ruta) => {
    expect(pasaSiempre(ruta)).toBe(true);
  });

  test.each([
    "/",
    "/productos",
    "/productos/teclado-mecanico-k120",
    "/mi-cuenta",
    "/carrito",
  ])("«%s» se cierra", (ruta) => {
    expect(pasaSiempre(ruta)).toBe(false);
  });

  /**
   * La excepción que pediste el 2026-09-11 a la regla del plan, que dejaba
   * pasar todo `(auth)`. Con la tienda cerrada nadie tiene para qué crear una
   * cuenta.
   */
  test("«/registro» y «/registro/verificar» se cierran, aunque son de (auth)", () => {
    expect(pasaSiempre("/registro")).toBe(false);
    expect(pasaSiempre("/registro/verificar")).toBe(false);
  });

  /**
   * Un `startsWith` a secas abriría cualquier ruta que empiece con las mismas
   * letras que una de la lista. Hoy no existe ninguna; el día que exista, esto
   * es lo que evita que nazca abierta sin que nadie lo decida.
   */
  test("el prefijo es de segmento: «/administrar» y «/apiarios» no pasan", () => {
    expect(pasaSiempre("/administrar")).toBe(false);
    expect(pasaSiempre("/apiarios")).toBe(false);
    expect(pasaSiempre("/marcas")).toBe(false);
  });
});

type FilaPrevia = {
  whatsappNumber: string;
  adminNotificationEmail: string;
  lowStockThreshold: number;
  maintenanceMode: boolean;
  updatedAt: Date;
};

describe("el interruptor (§5.9)", () => {
  let previa: FilaPrevia | undefined;

  const base = configuracionDelSitio.parse({
    whatsappNumber: "11 5555 5555",
    adminNotificationEmail: "ventas@anavende.com.ar",
    lowStockThreshold: 3,
  });

  beforeAll(async () => {
    [previa] = await db.execute<FilaPrevia>(sql`
      SELECT whatsapp_number          AS "whatsappNumber",
             admin_notification_email AS "adminNotificationEmail",
             low_stock_threshold      AS "lowStockThreshold",
             maintenance_mode         AS "maintenanceMode",
             updated_at               AS "updatedAt"
        FROM site_settings WHERE id = 1`);
  });

  // Lo recordado vive en el global del proceso: sin olvidarlo, un test leería
  // lo que dejó el anterior y no lo que hay en la base.
  beforeEach(olvidarElInterruptor);

  afterAll(async () => {
    olvidarElInterruptor();
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
    if (previa) {
      await db.execute(sql`
        INSERT INTO site_settings (id, whatsapp_number, admin_notification_email,
                                   low_stock_threshold, maintenance_mode, updated_at)
        VALUES (1, ${previa.whatsappNumber}, ${previa.adminNotificationEmail},
                ${previa.lowStockThreshold}, ${previa.maintenanceMode},
                ${previa.updatedAt})`);
    }
  });

  async function sinFila() {
    await db.execute(sql`DELETE FROM site_settings WHERE id = 1`);
  }

  test("sin fila la tienda está abierta, y prenderlo no inventa una", async () => {
    await sinFila();

    expect(await estaEnMantenimiento()).toBe(false);
    expect(await elModoMantenimiento()).toBeNull();

    // `null` es lo que la acción traduce en «guardá primero la configuración».
    expect(await escribirElModoMantenimiento(true)).toBeNull();

    const [{ n }] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM site_settings`,
    );
    expect(n).toBe(0);
  });

  test("una configuración recién guardada arranca abierta", async () => {
    await sinFila();
    await escribirLaConfiguracion(base);

    expect(await elModoMantenimiento()).toBe(false);
    expect(await estaEnMantenimiento()).toBe(false);
  });

  test("cerrar y reabrir llega a lo que lee el proxy", async () => {
    await sinFila();
    await escribirLaConfiguracion(base);

    expect(await escribirElModoMantenimiento(true)).toBe(true);
    olvidarElInterruptor();
    expect(await estaEnMantenimiento()).toBe(true);

    expect(await escribirElModoMantenimiento(false)).toBe(false);
    olvidarElInterruptor();
    expect(await estaEnMantenimiento()).toBe(false);
  });

  /**
   * El UPSERT de la configuración no nombra la columna, y esto es lo que
   * cuida que siga sin nombrarla: si un día lo hiciera, cambiar el número de
   * WhatsApp con la tienda cerrada la reabriría en medio de la carga.
   */
  test("guardar la configuración NO reabre la tienda", async () => {
    await sinFila();
    await escribirLaConfiguracion(base);
    await escribirElModoMantenimiento(true);

    await escribirLaConfiguracion({ ...base, lowStockThreshold: 9 });

    expect(await elModoMantenimiento()).toBe(true);
  });

  /**
   * La memoria es lo que ahorra una consulta por pedido, y también lo que hace
   * que el cambio tarde en notarse en el proxy. Se prueba de los dos lados:
   * sin olvidar se sigue viendo lo viejo, y olvidando se ve lo nuevo.
   */
  test("el proxy recuerda el interruptor hasta que se lo olvida", async () => {
    await sinFila();
    await escribirLaConfiguracion(base);
    await escribirElModoMantenimiento(true);
    expect(await estaEnMantenimiento()).toBe(true);

    // Por afuera de la acción, como si lo hubiera cambiado otra instancia.
    await db.execute(sql`UPDATE site_settings SET maintenance_mode = false WHERE id = 1`);
    expect(await estaEnMantenimiento()).toBe(true);

    olvidarElInterruptor();
    expect(await estaEnMantenimiento()).toBe(false);
  });
});

describe("quién ve la tienda cerrada", () => {
  afterEach(limpiarCompradores);

  test("una administradora sí", async () => {
    const { userId } = await unComprador();
    await db.execute(sql`UPDATE user_profiles SET role = 'admin' WHERE id = ${userId}`);

    expect(await puedeVerLaTiendaCerrada(userId)).toBe(true);
  });

  test("un comprador no", async () => {
    const { userId } = await unComprador();
    expect(await puedeVerLaTiendaCerrada(userId)).toBe(false);
  });

  /**
   * RF-27: bloquear corta todo. Una administradora bloqueada no entra al
   * panel, y tampoco puede mirar la tienda que el resto no ve.
   */
  test("una administradora bloqueada no", async () => {
    const { userId } = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET role = 'admin', is_banned = true, ban_reason = 'Prueba de F2.7b'
       WHERE id = ${userId}`);

    expect(await puedeVerLaTiendaCerrada(userId)).toBe(false);
  });

  test("una identidad sin perfil no", async () => {
    expect(
      await puedeVerLaTiendaCerrada("00000000-0000-0000-0000-000000000000"),
    ).toBe(false);
  });
});
