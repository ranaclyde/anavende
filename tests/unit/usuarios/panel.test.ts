import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { createServiceClient } from "@/lib/supabase/service";
import { limpiar, unaVariante } from "@/tests/apoyo/catalogo";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { limpiarOrdenes, unaOrdenActiva } from "@/tests/apoyo/ordenes";

/**
 * F7.6 — Gestión de usuarios. RF-26 · TS §13.2, §13.4.
 *
 * «Hecho cuando»: crear, editar, resetear contraseña; un admin no puede
 * quitarse el rol ni bloquearse.
 *
 * **Habla con el GoTrue del stack local**, y es el primer archivo que lo hace:
 * el alta de RF-26 no es un `INSERT`, es una invitación que crea una identidad
 * y manda un email. Lo que puede romperse en silencio está justo ahí —que la
 * identidad y el perfil queden los dos o ninguno (§13.4)—, así que probarlo
 * contra un doble no probaría nada. El entorno de tests ya exige que la API
 * sea la del stack local (`tests/setup/entorno.ts`).
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));

const {
  cambiarRol,
  darDeAltaUsuario,
  guardarDatosDelUsuario,
  mandarRestablecerContrasena,
} = await import("@/modules/users/panel/actions");
const { contarAdministradoras, leerUsuarioDelPanel, listarUsuarios } =
  await import("@/modules/users/panel/queries");
const { FILTROS_VACIOS } = await import("@/modules/users/panel/filtros");

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
    },
  };
}

/** Lo que crea la acción —identidad incluida— se borra por las dos puntas. */
const invitados: string[] = [];

async function borrarInvitados() {
  const servicio = createServiceClient();
  for (const id of invitados.splice(0)) {
    await db.execute(sql`DELETE FROM user_profiles WHERE id = ${id}`);
    await servicio.auth.admin.deleteUser(id);
  }
}

afterEach(async () => {
  sesion.actual = null;
  await limpiarOrdenes();
  await borrarInvitados();
  await limpiarCompradores();
  await limpiar();
});

/** Un email que no puede chocar con otra corrida. */
function unEmail(): string {
  return `panel-${randomUUID().slice(0, 8)}@ejemplo.test`;
}

const DATOS_DE_ALTA: {
  firstName: string;
  lastName: string;
  phone: string;
  rol: "customer" | "admin";
} = {
  firstName: "Rosa",
  lastName: "Pereyra",
  phone: "11 5555 5555",
  rol: "customer",
};

async function invitar(extra: Partial<typeof DATOS_DE_ALTA> = {}) {
  const email = unEmail();
  const r = await darDeAltaUsuario({ ...DATOS_DE_ALTA, ...extra, email });
  if (r.ok) invitados.push(r.data.id);
  return { r, email };
}

async function perfilDe(id: string) {
  const [fila] = await db.execute<{
    role: string;
    phone: string;
    fullName: string;
    email: string;
  }>(sql`
    SELECT role, phone, full_name AS "fullName", email
      FROM user_profiles WHERE id = ${id}`);
  return fila;
}

describe("quién puede administrar cuentas", () => {
  test("sin sesión no se crea, ni se edita, ni se cambia el rol", async () => {
    const otro = await unComprador();

    expect(
      await darDeAltaUsuario({ ...DATOS_DE_ALTA, email: unEmail() }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(
      await guardarDatosDelUsuario({
        id: otro.userId,
        firstName: "Otra",
        lastName: "Persona",
        phone: "11 5555 5555",
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    expect(await cambiarRol({ id: otro.userId, rol: "admin" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });

    expect(
      await mandarRestablecerContrasena({ id: otro.userId }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  test("un comprador tampoco, ni sobre su propia cuenta", async () => {
    const comprador = await unComprador();
    comoSesion(comprador.userId, "customer");

    expect(
      await guardarDatosDelUsuario({
        id: comprador.userId,
        firstName: "Yo",
        lastName: "Mismo",
        phone: "11 5555 5555",
      }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });

    // Para sus propios datos está «Mis datos» (F5.2), que filtra por sesión.
    expect(
      await cambiarRol({ id: comprador.userId, rol: "admin" }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("alta por invitación (RF-26)", () => {
  test("crea la identidad y el perfil, con su rol y su teléfono", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { r, email } = await invitar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const perfil = await perfilDe(r.data.id);
    expect(perfil).toMatchObject({
      role: "customer",
      fullName: "Rosa Pereyra",
      email,
      // RF-05: normalizado, como en las otras dos vías de alta.
      phone: "+5491155555555",
    });

    // La identidad existe de verdad: es lo que hace que pueda entrar.
    const { data } = await createServiceClient().auth.admin.getUserById(
      r.data.id,
    );
    expect(data.user?.email).toBe(email);
    // `first_name` en los metadatos es con lo que E3 saluda.
    expect(data.user?.user_metadata).toMatchObject({ first_name: "Rosa" });
  });

  test("puede nacer administradora, que es la vía que reemplaza al UPDATE a mano", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { r } = await invitar({ rol: "admin" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect((await perfilDe(r.data.id)).role).toBe("admin");
  });

  test("el email repetido se contesta en el campo, no como un fallo", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { email } = await invitar();
    const r = await darDeAltaUsuario({ ...DATOS_DE_ALTA, email });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    if (r.ok) return;
    expect(
      (
        r.details?.fields as {
          properties?: Record<string, { errors: string[] }>;
        }
      )?.properties?.email?.errors[0],
    ).toContain("Ya hay una cuenta");
  });

  test("sin teléfono válido no hay alta, y no queda identidad suelta", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const email = unEmail();
    const r = await darDeAltaUsuario({
      ...DATOS_DE_ALTA,
      email,
      phone: "123",
    });

    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });

    // La validación corre ANTES de tocar GoTrue: no hay nada que compensar.
    const [fila] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM auth.users WHERE email = ${email}`);
    expect(fila.n).toBe(0);
  });
});

describe("editar datos (RF-26)", () => {
  test("corrige nombre y teléfono, y el nombre para mostrar se rearma solo", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await guardarDatosDelUsuario({
        id: otro.userId,
        firstName: "María",
        lastName: "Gómez Paz",
        phone: "2920 55-5000",
      }),
    ).toMatchObject({ ok: true });

    expect(await perfilDe(otro.userId)).toMatchObject({
      fullName: "María Gómez Paz",
      phone: "+5492920555000",
    });
  });

  test("un id que no existe no encuentra nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await guardarDatosDelUsuario({
        id: randomUUID(),
        firstName: "Nadie",
        lastName: "Acá",
        phone: "11 5555 5555",
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("cambiar el rol (RF-26)", () => {
  test("da y quita el acceso al panel", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles SET role = 'admin' WHERE id = ${ana.userId}`);
    comoSesion(ana.userId, "admin");

    expect(await cambiarRol({ id: otro.userId, rol: "admin" })).toMatchObject({
      ok: true,
      data: { cambiado: true },
    });
    expect((await perfilDe(otro.userId)).role).toBe("admin");

    expect(
      await cambiarRol({ id: otro.userId, rol: "customer" }),
    ).toMatchObject({ ok: true, data: { cambiado: true } });
    expect((await perfilDe(otro.userId)).role).toBe("customer");
  });

  test("pedir el rol que ya tiene no cambia nada", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await cambiarRol({ id: otro.userId, rol: "customer" }),
    ).toMatchObject({ ok: true, data: { cambiado: false } });
  });

  test("no se lo puede cambiar a sí misma", async () => {
    const ana = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles SET role = 'admin' WHERE id = ${ana.userId}`);
    comoSesion(ana.userId, "admin");

    // Es la regla que RF-26 pide, y la que evita el clic distraído que deja
    // a quien lo hizo sin panel en la pantalla siguiente.
    const r = await cambiarRol({ id: ana.userId, rol: "customer" });
    expect(r).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await perfilDe(ana.userId)).role).toBe("admin");
  });

  test("a la última administradora no se le quita el rol", async () => {
    // La regla habla de **cuántas quedan**, así que hay que dejar una sola en
    // toda la base. Las que ya estaban se anotan y se devuelven a su rol al
    // terminar: la base de desarrollo es la misma con la que se mira el panel,
    // y un test que la deja sin ninguna administradora deja a quien la use
    // afuera, con un `UPDATE` a mano como única salida. Pasó una vez.
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

      expect(await contarAdministradoras()).toBe(1);

      const r = await cambiarRol({ id: unica.userId, rol: "customer" });
      expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
      expect(r).toMatchObject({ message: expect.stringContaining("única") });
      expect((await perfilDe(unica.userId)).role).toBe("admin");
    } finally {
      for (const p of previas) {
        await db.execute(sql`
          UPDATE user_profiles SET role = 'admin' WHERE id = ${p.id}`);
      }
    }
  });
});

describe("restablecer la contraseña (RF-26)", () => {
  test("dispara el email de recuperación a la dirección de la cuenta", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { r } = await invitar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const envio = await mandarRestablecerContrasena({ id: r.data.id });
    expect(envio).toMatchObject({ ok: true });
    if (!envio.ok) return;
    // La pantalla dice a qué dirección salió, así que la acción la devuelve.
    expect(envio.data.email).toContain("@ejemplo.test");
  });

  test("a una cuenta bloqueada no se le manda: no va a poder entrar igual", async () => {
    const ana = await unComprador();
    const otro = await unComprador();
    await db.execute(sql`
      UPDATE user_profiles
         SET is_banned = true, ban_reason = 'Prueba', banned_at = now()
       WHERE id = ${otro.userId}`);
    comoSesion(ana.userId, "admin");

    expect(
      await mandarRestablecerContrasena({ id: otro.userId }),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  test("un id que no existe no encuentra nada", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    expect(
      await mandarRestablecerContrasena({ id: randomUUID() }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("lo que la pantalla lee", () => {
  test("busca por nombre y por email, sin que los acentos molesten", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { r, email } = await invitar({
      firstName: "Martín",
      lastName: "Gómez",
    });
    if (!r.ok) return;

    const porNombre = await listarUsuarios({ ...FILTROS_VACIOS, q: "gomez" });
    expect(porNombre.usuarios.map((u) => u.id)).toContain(r.data.id);

    const porEmail = await listarUsuarios({
      ...FILTROS_VACIOS,
      q: email.split("@")[0],
    });
    expect(porEmail.usuarios.map((u) => u.id)).toContain(r.data.id);

    const otro = await listarUsuarios({
      ...FILTROS_VACIOS,
      q: "zzzz-no-existe",
    });
    expect(otro.usuarios).toHaveLength(0);
  });

  test("filtra por rol y por estado", async () => {
    const ana = await unComprador();
    comoSesion(ana.userId, "admin");

    const { r } = await invitar({ rol: "admin" });
    if (!r.ok) return;

    const admins = await listarUsuarios({ ...FILTROS_VACIOS, rol: "admin" });
    expect(admins.usuarios.map((u) => u.id)).toContain(r.data.id);
    expect(admins.usuarios.every((u) => u.rol === "admin")).toBe(true);

    const compradores = await listarUsuarios({
      ...FILTROS_VACIOS,
      rol: "customer",
    });
    expect(compradores.usuarios.map((u) => u.id)).not.toContain(r.data.id);

    await db.execute(sql`
      UPDATE user_profiles
         SET is_banned = true, ban_reason = 'Prueba', banned_at = now()
       WHERE id = ${r.data.id}`);

    const bloqueados = await listarUsuarios({
      ...FILTROS_VACIOS,
      estado: "bloqueados",
    });
    expect(bloqueados.usuarios.map((u) => u.id)).toContain(r.data.id);
    expect(bloqueados.usuarios.every((u) => u.bloqueado)).toBe(true);

    const activos = await listarUsuarios({
      ...FILTROS_VACIOS,
      estado: "activos",
    });
    expect(activos.usuarios.map((u) => u.id)).not.toContain(r.data.id);
  });

  test("la ficha trae sus últimas órdenes y cuántas tiene en total", async () => {
    const ana = await unComprador();
    const comprador = await unComprador();
    comoSesion(ana.userId, "admin");

    const { variantId } = await unaVariante({ total: 50 });
    const numeros: number[] = [];
    // Seis, para que se vea que la ficha muestra cinco.
    for (let i = 0; i < 6; i += 1) {
      const { orderId } = await unaOrdenActiva([{ variantId, quantity: 1 }]);
      await db.execute(sql`
        UPDATE orders SET user_id = ${comprador.userId} WHERE id = ${orderId}`);
      const [fila] = await db.execute<{ numero: number }>(sql`
        SELECT order_number AS numero FROM orders WHERE id = ${orderId}`);
      numeros.push(fila.numero);
    }

    const ficha = await leerUsuarioDelPanel(comprador.userId);
    expect(ficha).not.toBeNull();
    expect(ficha!.ordenes).toBe(6);
    expect(ficha!.ultimasOrdenes).toHaveLength(5);
    // De la más nueva a la más vieja: la primera de las seis queda afuera.
    expect(ficha!.ultimasOrdenes.map((o) => o.numero)).not.toContain(
      numeros[0],
    );
    expect(ficha!.ultimasOrdenes[0].unidades).toBe(1);

    // Y el listado cuenta lo mismo sin traer las órdenes.
    const listado = await listarUsuarios({
      ...FILTROS_VACIOS,
      q: comprador.userId.slice(0, 0) || "Compradora",
    });
    const fila = listado.usuarios.find((u) => u.id === comprador.userId);
    expect(fila?.ordenes).toBe(6);
  });

  test("un id que no existe no devuelve ficha", async () => {
    expect(await leerUsuarioDelPanel(randomUUID())).toBeNull();
  });
});
