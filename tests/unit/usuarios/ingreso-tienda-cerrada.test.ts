import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { db } from "@/db";
import { createServiceClient } from "@/lib/supabase/service";
import { CAPTCHA_DE_PRUEBA } from "@/tests/apoyo/captcha";

/**
 * Con la tienda cerrada, entrar es solo para administradoras — decisión tuya
 * del 2026-10-26.
 *
 * Contra el GoTrue del stack local, como `bloqueo.test.ts`: lo que se prueba
 * es que una contraseña correcta de compradora **no** deje la sesión abierta,
 * y eso solo lo dice GoTrue. La vuelta de Google usa la misma
 * `laTiendaEstaCerradaPara`; lo que no se puede probar acá es el intercambio
 * con Google, que necesita una cuenta real (pasos de prueba del PR).
 *
 * Escribe el interruptor de verdad y lo repone al terminar, como
 * `mantenimiento.test.ts`.
 */

vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

/** El cliente del servidor sin cookies, por lo mismo que en `bloqueo.test.ts`. */
vi.mock("@/lib/supabase/server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    createClient: async () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
  };
});

const { ingresar } = await import("@/modules/users/actions");
const { laTiendaEstaCerradaPara, olvidarElInterruptor } =
  await import("@/modules/settings/mantenimiento");

const CONTRASENA = "una-contrasena-de-prueba";
const creadas: string[] = [];
let previo: boolean | null = null;

async function tienda(cerrada: boolean) {
  await db.execute(
    sql`UPDATE site_settings SET maintenance_mode = ${cerrada} WHERE id = 1`,
  );
  olvidarElInterruptor();
}

async function unaCuenta(rol: "customer" | "admin") {
  const email = `cerrada-${randomUUID().slice(0, 8)}@ejemplo.test`;
  const { data, error } = await createServiceClient().auth.admin.createUser({
    email,
    password: CONTRASENA,
    email_confirm: true,
  });
  if (error) throw error;
  creadas.push(data.user.id);
  await db.execute(sql`
    INSERT INTO user_profiles (id, first_name, last_name, email, phone, role)
    VALUES (${data.user.id}, 'Rosa', 'Pereyra', ${email}, '+5491155550000', ${rol})`);
  return { id: data.user.id, email };
}

const entrar = (email: string) =>
  ingresar({ email, password: CONTRASENA, captcha: CAPTCHA_DE_PRUEBA });

beforeAll(async () => {
  const [fila] = await db.execute<{ activo: boolean }>(sql`
    SELECT maintenance_mode AS activo FROM site_settings WHERE id = 1`);
  if (!fila)
    throw new Error("El stack local no tiene la configuración guardada.");
  previo = fila.activo;
});

beforeEach(() => tienda(false));

afterAll(async () => {
  if (previo !== null) await tienda(previo);
  for (const id of creadas.splice(0)) {
    await createServiceClient().auth.admin.deleteUser(id);
  }
});

describe("laTiendaEstaCerradaPara", () => {
  test("abierta, para nadie", async () => {
    const compradora = await unaCuenta("customer");
    expect(await laTiendaEstaCerradaPara(compradora.id)).toBe(false);
  });

  test("cerrada, para la compradora y para una cuenta sin perfil, no para la administradora", async () => {
    const compradora = await unaCuenta("customer");
    const ana = await unaCuenta("admin");
    await tienda(true);

    expect(await laTiendaEstaCerradaPara(compradora.id)).toBe(true);
    expect(await laTiendaEstaCerradaPara(ana.id)).toBe(false);
    expect(await laTiendaEstaCerradaPara(randomUUID())).toBe(true);
  });
});

describe("el ingreso con contraseña", () => {
  test("con la tienda abierta, la compradora entra", async () => {
    const compradora = await unaCuenta("customer");
    expect(await entrar(compradora.email)).toMatchObject({ ok: true });
  });

  test("con la tienda cerrada, la compradora no entra y se le dice por qué", async () => {
    const compradora = await unaCuenta("customer");
    await tienda(true);

    const r = await entrar(compradora.email);
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(r.ok === false && r.message).toBe(
      "El sitio está en mantenimiento. Por favor, intentá de nuevo más tarde.",
    );
  });

  test("con la tienda cerrada, la administradora entra", async () => {
    const ana = await unaCuenta("admin");
    await tienda(true);
    expect(await entrar(ana.email)).toMatchObject({ ok: true });
  });

  test("con la tienda cerrada y la contraseña mal, el mensaje de siempre", async () => {
    const compradora = await unaCuenta("customer");
    await tienda(true);

    const r = await ingresar({
      email: compradora.email,
      password: "otra-cosa",
      captcha: CAPTCHA_DE_PRUEBA,
    });
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(JSON.stringify(r)).not.toContain("mantenimiento");
  });
});
