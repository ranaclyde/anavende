import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { leerErrores } from "@/lib/form";
import { createServiceClient } from "@/lib/supabase/service";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { limpiarOrdenes, unaOrdenActiva } from "@/tests/apoyo/ordenes";

/**
 * F7.7 — Bloqueo con razón. RF-27 · TS §5.3, §13.5.
 *
 * «Hecho cuando»: motivo obligatorio garantizado por el `CHECK` de la base; se
 * bloquea en Supabase Auth **y** se cierran las sesiones activas; al intentar
 * entrar, la persona ve el motivo registrado.
 *
 * **Habla con el GoTrue del stack local**, como los de F7.6 y por un motivo
 * más fuerte todavía: el bloqueo vive en dos lados —`user_profiles` y
 * `auth.users`— y lo que puede romperse en silencio es que queden
 * desincronizados. Un doble no probaría nada de eso; el ingreso rechazado con
 * su motivo, que es el criterio que RF-27 le promete a la persona, tampoco.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

/**
 * El cliente del servidor, sin cookies — sólo para probar el ingreso.
 *
 * `modules/users/actions` arma su cliente con `cookies()` de Next, que fuera
 * de un pedido no existe. Lo que se prueba acá no es el manejo de cookies —de
 * eso se ocupa `@supabase/ssr`— sino que GoTrue rechace a la cuenta bloqueada
 * y que ese rechazo llegue a la pantalla **con el motivo**, que es lo que
 * RF-27 promete y lo único que GoTrue no sabe.
 */
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

const { bloquearCuenta, desbloquearCuenta } = await import(
  "@/modules/users/panel/actions"
);
const { leerUsuarioDelPanel } = await import("@/modules/users/panel/queries");
const { tieneElAccesoCortado } = await import("@/modules/users/acceso");
const { ingresar } = await import("@/modules/users/actions");

function comoSesion(userId: string, role: "admin" | "customer") {
  sesion.actual = {
    identity: { userId, email: "ana@ejemplo.test", emailVerified: true },
    role,
    profile: {
      id: userId,
      email: "ana@ejemplo.test",
      isBanned: false,
      banReason: null,
      closureRequestedAt: null,
      closedAt: null,
    },
  };
}

/** Lo que se crea por GoTrue se borra por las dos puntas. */
const deVerdad: string[] = [];

afterEach(async () => {
  sesion.actual = null;
  const servicio = createServiceClient();
  for (const id of deVerdad.splice(0)) {
    await db.execute(sql`DELETE FROM orders WHERE user_id = ${id}`);
    await db.execute(sql`DELETE FROM user_profiles WHERE id = ${id}`);
    await servicio.auth.admin.deleteUser(id);
  }
  await limpiarOrdenes();
  await limpiarCompradores();
  await limpiar();
});

const CONTRASENA = "bloqueo-12345678";

/**
 * Una cuenta con identidad de GoTrue y contraseña: la única forma de probar
 * que el bloqueo impide entrar, que es lo que RF-27 promete.
 */
async function unaCuentaDeVerdad(): Promise<{ id: string; email: string }> {
  const email = `bloqueo-${randomUUID().slice(0, 8)}@ejemplo.test`;
  const { data, error } = await createServiceClient().auth.admin.createUser({
    email,
    password: CONTRASENA,
    email_confirm: true,
  });

  if (error || !data.user) throw error ?? new Error("no se creó la identidad");
  deVerdad.push(data.user.id);

  await db.execute(sql`
    INSERT INTO user_profiles (id, first_name, last_name, email, phone)
    VALUES (${data.user.id}, 'Rosa', 'Pereyra', ${email}, '+5491155550000')`);

  return { id: data.user.id, email };
}

async function elBloqueo(id: string) {
  const [fila] = await db.execute<{
    bloqueado: boolean;
    motivo: string | null;
    fecha: string | null;
    autor: string | null;
  }>(sql`
    SELECT is_banned  AS bloqueado,
           ban_reason AS motivo,
           banned_at  AS fecha,
           banned_by  AS autor
      FROM user_profiles WHERE id = ${id}`);
  return fila;
}

async function elHistorial(id: string) {
  return [
    ...(await db.execute<{
      evento: string;
      motivo: string | null;
      autor: string | null;
    }>(sql`
      SELECT event AS evento, reason AS motivo, actor_user_id AS autor
        FROM user_status_history
       WHERE user_id = ${id}
       ORDER BY created_at DESC`)),
  ];
}

async function bloqueadoEnAuth(id: string): Promise<boolean> {
  const { data } = await createServiceClient().auth.admin.getUserById(id);
  const hasta = (data.user as { banned_until?: string } | null)?.banned_until;
  return Boolean(hasta && new Date(hasta) > new Date());
}

describe("quién puede bloquear", () => {
  test("sin sesión y como comprador, no", async () => {
    const otro = await unComprador();

    expect(
      await bloquearCuenta({ id: otro.userId, motivo: "Probando" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    comoSesion(otro.userId, "customer");
    expect(
      await bloquearCuenta({ id: otro.userId, motivo: "Probando" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await desbloquearCuenta({ id: otro.userId })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  test("no puede bloquearse a sí misma (RF-26)", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    // Es el clic que la deja afuera del panel en la pantalla siguiente.
    expect(
      await bloquearCuenta({ id: ana.userId, motivo: "Me voy" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await elBloqueo(ana.userId)).bloqueado).toBe(false);
  });

  test("a la última administradora tampoco", async () => {
    // Como en el cambio de rol (F7.6): la regla habla de CUÁNTAS QUEDAN, así
    // que hay que dejar una sola en toda la base. Las que ya estaban se
    // devuelven a su rol al terminar — la base de desarrollo es la misma con
    // la que se mira el panel, y dejarla sin administradoras deja a quien la
    // use afuera.
    const previas = await db.execute<{ id: string }>(sql`
      SELECT id FROM user_profiles WHERE role = 'admin'`);

    try {
      await db.execute(sql`
        UPDATE user_profiles SET role = 'customer' WHERE role = 'admin'`);

      const ana = await unComprador();
      const unica = await unComprador();
      await db.execute(sql`
        UPDATE user_profiles SET role = 'admin' WHERE id = ${unica.userId}`);
      comoSesion(ana.userId, "admin");

      const r = await bloquearCuenta({ id: unica.userId, motivo: "Probando" });
      expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
      expect(r).toMatchObject({ message: expect.stringContaining("única") });
      expect((await elBloqueo(unica.userId)).bloqueado).toBe(false);
    } finally {
      for (const p of previas) {
        await db.execute(sql`
          UPDATE user_profiles SET role = 'admin' WHERE id = ${p.id}`);
      }
    }
  });

  test("un id que no existe no encuentra nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await bloquearCuenta({ id: randomUUID(), motivo: "Probando" }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await desbloquearCuenta({ id: randomUUID() })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("el motivo es obligatorio (RF-27)", () => {
  test("vacío o en blanco se contesta en el campo", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    for (const motivo of ["", "   "]) {
      const r = await bloquearCuenta({ id: otro.userId, motivo });
      expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
      // Va al campo y no como un fallo general: es lo que la pantalla marca.
      expect(r.ok === false && leerErrores<"motivo">(r).campos.motivo).toBeTruthy();
    }

    expect((await elBloqueo(otro.userId)).bloqueado).toBe(false);
  });

  test("se guarda recortado", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await bloquearCuenta({ id: otro.userId, motivo: "  Pagos rebotados  " });
    expect((await elBloqueo(otro.userId)).motivo).toBe("Pagos rebotados");
  });
});

describe("bloquear (RF-27)", () => {
  test("marca el perfil con motivo, fecha y autor, y deja su fila", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    const r = await bloquearCuenta({
      id: otro.userId,
      motivo: "Se llevó mercadería sin pagar",
    });
    expect(r).toMatchObject({ ok: true, data: { bloqueado: true } });

    const perfil = await elBloqueo(otro.userId);
    expect(perfil.bloqueado).toBe(true);
    expect(perfil.motivo).toBe("Se llevó mercadería sin pagar");
    expect(perfil.fecha).not.toBeNull();
    expect(perfil.autor).toBe(ana.userId);

    // §5.3: la fila del historial es lo que sobrevive al desbloqueo.
    expect(await elHistorial(otro.userId)).toEqual([
      {
        evento: "bloqueo",
        motivo: "Se llevó mercadería sin pagar",
        autor: ana.userId,
      },
    ]);
  });

  test("bloquear lo ya bloqueado no escribe una segunda fila", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await bloquearCuenta({ id: otro.userId, motivo: "El primero" });
    const r = await bloquearCuenta({ id: otro.userId, motivo: "El segundo" });

    // El doble clic y las dos pestañas. Una segunda fila contaría un bloqueo
    // que no ocurrió, y el motivo que vale es el primero.
    expect(r).toMatchObject({ ok: true, data: { bloqueado: false } });
    expect(await elHistorial(otro.userId)).toHaveLength(1);
    expect((await elBloqueo(otro.userId)).motivo).toBe("El primero");
  });

  test("no toca sus órdenes activas", async () => {
    const ana = await unComprador();
    const comprador = await unComprador();
    comoSesion(ana.userId, "admin");

    const { variantId } = await unaVariante({ total: 10 });
    const { orderId } = await unaOrdenActiva([{ variantId, quantity: 2 }]);
    await db.execute(sql`
      UPDATE orders SET user_id = ${comprador.userId} WHERE id = ${orderId}`);

    await bloquearCuenta({ id: comprador.userId, motivo: "Probando" });

    // RF-27: «el bloqueo no elimina ni altera sus órdenes; las activas siguen
    // su curso normal». Lo que se le debe entregar, se le entrega.
    const [orden] = await db.execute<{ status: string }>(sql`
      SELECT status FROM orders WHERE id = ${orderId}`);
    expect(orden.status).toBe("activa");
  });
});

describe("desbloquear (RF-27)", () => {
  test("limpia las cuatro columnas y deja su propia fila", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await bloquearCuenta({ id: otro.userId, motivo: "Un malentendido" });
    expect(await desbloquearCuenta({ id: otro.userId })).toMatchObject({
      ok: true,
      data: { desbloqueado: true },
    });

    expect(await elBloqueo(otro.userId)).toEqual({
      bloqueado: false,
      motivo: null,
      fecha: null,
      autor: null,
    });

    // Y acá está el registro que RF-27 pide: sin la tabla, lo de arriba sería
    // todo lo que queda, y no diría que el bloqueo existió.
    const historial = await elHistorial(otro.userId);
    expect(historial).toHaveLength(2);
    expect(historial[0]).toEqual({
      evento: "desbloqueo",
      motivo: null,
      autor: ana.userId,
    });
    expect(historial[1].evento).toBe("bloqueo");
  });

  test("desbloquear lo que no estaba bloqueado no hace nada", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(await desbloquearCuenta({ id: otro.userId })).toMatchObject({
      ok: true,
      data: { desbloqueado: false },
    });
    expect(await elHistorial(otro.userId)).toHaveLength(0);
  });
});

describe("las dos capas quedan sincronizadas (§13.5)", () => {
  test("bloquear marca también Supabase Auth, y desbloquear lo revierte", async () => {
    const ana = await unComprador();
    const cuenta = await unaCuentaDeVerdad();
    comoSesion(ana.userId, "admin");

    expect(await bloqueadoEnAuth(cuenta.id)).toBe(false);

    const r = await bloquearCuenta({ id: cuenta.id, motivo: "Probando" });
    expect(r).toMatchObject({ ok: true, data: { errorDeAuth: null } });
    expect(await bloqueadoEnAuth(cuenta.id)).toBe(true);

    const d = await desbloquearCuenta({ id: cuenta.id });
    expect(d).toMatchObject({ ok: true, data: { errorDeAuth: null } });
    expect(await bloqueadoEnAuth(cuenta.id)).toBe(false);
  });

  test("bloqueada no puede entrar, y lo que lee es el motivo registrado", async () => {
    const ana = await unComprador();
    const cuenta = await unaCuentaDeVerdad();
    comoSesion(ana.userId, "admin");

    // Antes del bloqueo entra sin problema: si no, lo de abajo no probaría
    // nada sobre el bloqueo.
    expect(
      await ingresar({ email: cuenta.email, password: CONTRASENA }),
    ).toMatchObject({ ok: true });

    await bloquearCuenta({ id: cuenta.id, motivo: "Pagos rebotados" });

    const r = await ingresar({ email: cuenta.email, password: CONTRASENA });
    expect(r).toMatchObject({ ok: false, code: "USER_BANNED" });
    // Es el criterio de RF-27: no alcanza con negar el acceso, hay que decir
    // por qué. El texto sale de `ban_reason`, que GoTrue no guarda.
    expect(r.ok === false && r.details?.motivo).toBe("Pagos rebotados");

    // Y después de desbloquear, vuelve a entrar con la misma contraseña.
    await desbloquearCuenta({ id: cuenta.id });
    expect(
      await ingresar({ email: cuenta.email, password: CONTRASENA }),
    ).toMatchObject({ ok: true });
  });
});

describe("la sesión que ya estaba abierta (RF-27, §13.3)", () => {
  test("`tieneElAccesoCortado` es lo que la guardia de ruta consulta", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    // El proxy no puede confiar en el token: se verifica localmente y sigue
    // valiendo hasta que vence. Esta lectura es la que cierra esa hora.
    expect(await tieneElAccesoCortado(otro.userId)).toBe(false);

    await bloquearCuenta({ id: otro.userId, motivo: "Probando" });
    expect(await tieneElAccesoCortado(otro.userId)).toBe(true);

    await desbloquearCuenta({ id: otro.userId });
    expect(await tieneElAccesoCortado(otro.userId)).toBe(false);
  });

  test("un id que no existe no está bloqueado", async () => {
    expect(await tieneElAccesoCortado(randomUUID())).toBe(false);
  });
});

describe("lo que la ficha lee", () => {
  test("trae el bloqueo vigente con su autor y el historial entero", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await bloquearCuenta({ id: otro.userId, motivo: "La primera vez" });
    await desbloquearCuenta({ id: otro.userId });
    await bloquearCuenta({ id: otro.userId, motivo: "La segunda vez" });

    const ficha = await leerUsuarioDelPanel(otro.userId);
    expect(ficha).not.toBeNull();
    expect(ficha!.bloqueado).toBe(true);
    expect(ficha!.motivoDelBloqueo).toBe("La segunda vez");
    // El nombre y no el id: es lo que la pantalla muestra.
    expect(ficha!.bloqueadoPor).toContain("Compradora");

    // Del más nuevo al más viejo, que es como se lee.
    expect(ficha!.historialDeEstado.map((m) => m.evento)).toEqual([
      "bloqueo",
      "desbloqueo",
      "bloqueo",
    ]);
    expect(ficha!.historialDeEstado[0].motivo).toBe("La segunda vez");
    expect(ficha!.historialDeEstado[2].motivo).toBe("La primera vez");
    expect(ficha!.historialDeEstado[0].autor).toContain("Compradora");
  });

  test("sin bloqueos el historial viene vacío, no nulo", async () => {
    const otro = await unComprador();
    const ficha = await leerUsuarioDelPanel(otro.userId);
    expect(ficha!.historialDeEstado).toEqual([]);
  });
});
