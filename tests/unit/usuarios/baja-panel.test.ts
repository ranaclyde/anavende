import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { createServiceClient } from "@/lib/supabase/service";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";

/**
 * F7.9 — Ejecutar y revertir bajas de cuenta. RF-34, RF-26, RN-13 · TS §13.5b.
 *
 * «Hecho cuando»: las bajas pendientes se ven con su motivo y se ejecutan;
 * ejecutar cierra las sesiones y deja registrado quién y cuándo; al intentar
 * entrar, la persona ve un mensaje **distinto del bloqueo**; revertir la
 * devuelve con todo lo suyo; el filtro por estado distingue los tres.
 *
 * **Habla con el GoTrue del stack local**, por lo mismo que F7.7: lo que puede
 * romperse en silencio es que `user_profiles` y `auth.users` queden
 * desincronizados, y el mensaje distinto —lo único que RN-13 pide y GoTrue no
 * sabe— sólo se ve con un ingreso de verdad, porque esa capa contesta
 * `user_banned` para las dos cosas.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

/** El cliente del servidor, sin cookies — igual que en F7.7 y por lo mismo. */
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

const { bloquearCuenta, ejecutarBajaDeCuenta, revertirBajaDeCuenta } =
  await import("@/modules/users/panel/actions");
const { contarBajasPendientes, pedirBaja, retirarBaja } =
  await import("@/modules/users/baja/operaciones");
const { leerUsuarioDelPanel, listarUsuarios } =
  await import("@/modules/users/panel/queries");
const { FILTROS_VACIOS } = await import("@/modules/users/panel/filtros");
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
    await db.execute(sql`DELETE FROM user_profiles WHERE id = ${id}`);
    await servicio.auth.admin.deleteUser(id);
  }
  await limpiarCompradores();
});

const CONTRASENA = "baja-12345678";

/** Una cuenta con identidad de GoTrue y contraseña, para probar el ingreso. */
async function unaCuentaDeVerdad(): Promise<{ id: string; email: string }> {
  const email = `baja-${randomUUID().slice(0, 8)}@ejemplo.test`;
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

async function laBaja(id: string) {
  const [fila] = await db.execute<{
    pedidaEl: string | null;
    motivo: string | null;
    ejecutadaEl: string | null;
    autor: string | null;
  }>(sql`
    SELECT closure_requested_at AS "pedidaEl",
           closure_reason       AS motivo,
           closed_at            AS "ejecutadaEl",
           closed_by            AS autor
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

async function cerradoEnAuth(id: string): Promise<boolean> {
  const { data } = await createServiceClient().auth.admin.getUserById(id);
  const hasta = (data.user as { banned_until?: string } | null)?.banned_until;
  return Boolean(hasta && new Date(hasta) > new Date());
}

describe("quién puede ejecutarla", () => {
  test("sin sesión y como comprador, no", async () => {
    const otro = await unComprador();
    await pedirBaja(otro.userId, "Ya no compro por acá");

    expect(await ejecutarBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    comoSesion(otro.userId, "customer");
    expect(await ejecutarBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(await revertirBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    expect((await laBaja(otro.userId)).ejecutadaEl).toBeNull();
  });
});

describe("ejecutar la baja (RF-34)", () => {
  test("sin pedido no se ejecuta: la baja la pide la persona", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    // Es la decisión del 2026-09-17: acá no hay «dar de baja» a nadie. Para
    // sacar a alguien por decisión de la vendedora está el bloqueo (RF-27).
    expect(await ejecutarBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: false,
      code: "INVALID_ORDER_STATE",
    });
    expect((await laBaja(otro.userId)).ejecutadaEl).toBeNull();
    expect(await elHistorial(otro.userId)).toHaveLength(0);
  });

  test("deja quién y cuándo, y el motivo del comprador en el historial", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Me mudé al exterior");
    expect(await ejecutarBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: true,
      data: { ejecutada: true },
    });

    const baja = await laBaja(otro.userId);
    expect(baja.ejecutadaEl).not.toBeNull();
    expect(baja.autor).toBe(ana.userId);
    // El pedido no se borra al ejecutarlo: es lo que contesta por qué esa
    // cuenta ya no está.
    expect(baja.motivo).toBe("Me mudé al exterior");

    // Y el motivo que queda registrado es el de la persona, no uno inventado
    // por quien apretó el botón.
    expect(await elHistorial(otro.userId)).toEqual([
      { evento: "baja", motivo: "Me mudé al exterior", autor: ana.userId },
    ]);
  });

  test("ejecutarla dos veces no escribe dos veces", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Chau");
    await ejecutarBajaDeCuenta({ id: otro.userId });
    const r = await ejecutarBajaDeCuenta({ id: otro.userId });

    // El doble clic y las dos pestañas, igual que en el bloqueo.
    expect(r).toMatchObject({ ok: true, data: { ejecutada: false } });
    expect(await elHistorial(otro.userId)).toHaveLength(1);
  });

  test("deja de contarse como pendiente", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    const antes = await contarBajasPendientes();
    await pedirBaja(otro.userId, "Chau");
    expect(await contarBajasPendientes()).toBe(antes + 1);

    // Ejecutada deja de ser trabajo por hacer: si siguiera contándose, el
    // inicio del panel avisaría para siempre de algo ya resuelto.
    await ejecutarBajaDeCuenta({ id: otro.userId });
    expect(await contarBajasPendientes()).toBe(antes);
  });

  test("una cuenta dada de baja no se bloquea encima", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Chau");
    await ejecutarBajaDeCuenta({ id: otro.userId });

    // Las dos marcas juntas dejarían a la pantalla de ingreso eligiendo cuál
    // de los dos mensajes da (RN-13). Que no se crucen es más barato.
    expect(
      await bloquearCuenta({ id: otro.userId, motivo: "Por las dudas" }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("el comprador ya no la deshace (RF-34)", () => {
  test("retirar el pedido no revierte una baja ejecutada", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Chau");
    await ejecutarBajaDeCuenta({ id: otro.userId });

    // Sin la condición del `WHERE`, quien fue dado de baja se reabriría la
    // cuenta solo: es la única acción de comprador que el envoltorio deja
    // pasar con la baja puesta. Volver se le pide a la administradora.
    expect(await retirarBaja(otro.userId)).toEqual({ retirada: false });
    expect((await laBaja(otro.userId)).ejecutadaEl).not.toBeNull();
  });
});

describe("revertirla (RF-34)", () => {
  test("limpia la ejecución y el pedido, y deja su propia fila", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Me mudé al exterior");
    await ejecutarBajaDeCuenta({ id: otro.userId });
    expect(await revertirBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: true,
      data: { revertida: true },
    });

    // Vuelve entera: dejarle el pedido puesto la devolvería a solo lectura,
    // que es un estado que nadie eligió.
    expect(await laBaja(otro.userId)).toEqual({
      pedidaEl: null,
      motivo: null,
      ejecutadaEl: null,
      autor: null,
    });

    // Y acá está lo único que queda de que la baja existió.
    const historial = await elHistorial(otro.userId);
    expect(historial).toHaveLength(2);
    expect(historial[0]).toEqual({
      evento: "reversion_de_baja",
      motivo: null,
      autor: ana.userId,
    });
    expect(historial[1].evento).toBe("baja");
  });

  test("no se borró nada: sus direcciones y su carrito siguen ahí", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Chau");
    await ejecutarBajaDeCuenta({ id: otro.userId });
    await revertirBajaDeCuenta({ id: otro.userId });

    // RF-34: «vuelve con su historial, sus direcciones y sus favoritos
    // intactos». La baja es una marca, y sacarla alcanza (§5.6).
    const [conteo] = await db.execute<{
      direcciones: number;
      carritos: number;
    }>(sql`
      SELECT (SELECT count(*)::int FROM addresses WHERE user_id = ${otro.userId})
               AS direcciones,
             (SELECT count(*)::int FROM carts     WHERE user_id = ${otro.userId})
               AS carritos`);
    expect(conteo).toEqual({ direcciones: 1, carritos: 1 });
  });

  test("revertir lo que no estaba dado de baja no hace nada", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(await revertirBajaDeCuenta({ id: otro.userId })).toMatchObject({
      ok: true,
      data: { revertida: false },
    });
    expect(await elHistorial(otro.userId)).toHaveLength(0);
  });
});

describe("las dos capas quedan sincronizadas (§13.5b)", () => {
  test("ejecutar marca también Supabase Auth, y revertir lo levanta", async () => {
    const ana = await unComprador();
    const cuenta = await unaCuentaDeVerdad();
    comoSesion(ana.userId, "admin");

    await pedirBaja(cuenta.id, "Chau");
    expect(await cerradoEnAuth(cuenta.id)).toBe(false);

    const r = await ejecutarBajaDeCuenta({ id: cuenta.id });
    expect(r).toMatchObject({ ok: true, data: { errorDeAuth: null } });
    expect(await cerradoEnAuth(cuenta.id)).toBe(true);

    const v = await revertirBajaDeCuenta({ id: cuenta.id });
    expect(v).toMatchObject({ ok: true, data: { errorDeAuth: null } });
    expect(await cerradoEnAuth(cuenta.id)).toBe(false);
  });

  test("dada de baja no entra, y LEE ALGO DISTINTO del bloqueo (RN-13)", async () => {
    const ana = await unComprador();
    const cuenta = await unaCuentaDeVerdad();
    comoSesion(ana.userId, "admin");

    expect(
      await ingresar({ email: cuenta.email, password: CONTRASENA }),
    ).toMatchObject({ ok: true });

    await pedirBaja(cuenta.id, "Ya no compro por acá");
    await ejecutarBajaDeCuenta({ id: cuenta.id });

    // Para GoTrue esto es `user_banned`, el MISMO código que un bloqueo: quién
    // es cada uno lo decide nuestra capa mirando el perfil. Sin eso, a quien
    // se fue por su cuenta le diríamos que lo bloquearon.
    const r = await ingresar({ email: cuenta.email, password: CONTRASENA });
    expect(r).toMatchObject({ ok: false, code: "ACCOUNT_CLOSED" });
    expect(r.ok === false && r.code).not.toBe("USER_BANNED");

    // Y revertida, vuelve a entrar con la misma contraseña de siempre.
    await revertirBajaDeCuenta({ id: cuenta.id });
    expect(
      await ingresar({ email: cuenta.email, password: CONTRASENA }),
    ).toMatchObject({ ok: true });
  });

  test("la guardia de ruta le corta la sesión que ya tenía", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Chau");
    // Con la baja sólo pedida sigue entrando: la cuenta es de solo lectura,
    // no está cerrada.
    expect(await tieneElAccesoCortado(otro.userId)).toBe(false);

    await ejecutarBajaDeCuenta({ id: otro.userId });
    expect(await tieneElAccesoCortado(otro.userId)).toBe(true);

    await revertirBajaDeCuenta({ id: otro.userId });
    expect(await tieneElAccesoCortado(otro.userId)).toBe(false);
  });
});

describe("lo que el panel lee (RF-26)", () => {
  test("la ficha distingue pedida de ejecutada", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(otro.userId, "Me mudé al exterior");
    const pedida = await leerUsuarioDelPanel(otro.userId);
    expect(pedida).toMatchObject({
      bajaPedida: true,
      dadoDeBaja: false,
      motivoDeLaBaja: "Me mudé al exterior",
      dadoDeBajaEn: null,
    });

    await ejecutarBajaDeCuenta({ id: otro.userId });
    const ejecutada = await leerUsuarioDelPanel(otro.userId);
    // Ejecutada deja de ser trabajo por hacer y pasa a ser un estado: las dos
    // etiquetas no se muestran juntas.
    expect(ejecutada).toMatchObject({ bajaPedida: false, dadoDeBaja: true });
    expect(ejecutada?.dadoDeBajaEn).not.toBeNull();
    expect(ejecutada?.dadoDeBajaPor).toBe(
      (await leerUsuarioDelPanel(ana.userId))?.nombre,
    );
  });

  test("el filtro por estado separa los tres, y el pendiente aparte", async () => {
    const ana = await unComprador();
    const pide = await unComprador();
    const seFue = await unComprador();
    comoSesion(ana.userId, "admin");

    await pedirBaja(pide.userId, "Chau");
    await pedirBaja(seFue.userId, "Chau");
    await ejecutarBajaDeCuenta({ id: seFue.userId });

    const ids = async (estado: "activos" | "baja-pedida" | "dados-de-baja") =>
      (await listarUsuarios({ ...FILTROS_VACIOS, estado })).usuarios.map(
        (u) => u.id,
      );

    // «Con baja pedida» es a donde lleva el aviso del inicio del panel: la
    // cuenta está activa, en solo lectura, esperando que alguien la atienda.
    expect(await ids("baja-pedida")).toContain(pide.userId);
    expect(await ids("baja-pedida")).not.toContain(seFue.userId);

    const bajas = await ids("dados-de-baja");
    expect(bajas).toContain(seFue.userId);
    expect(bajas).not.toContain(pide.userId);

    // Y quien pidió la baja sigue siendo una cuenta activa; quien ya se fue,
    // no.
    const activos = await ids("activos");
    expect(activos).toContain(pide.userId);
    expect(activos).not.toContain(seFue.userId);
  });
});
