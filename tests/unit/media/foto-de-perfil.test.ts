import { sql } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { limpiarCompradores, unComprador } from "@/tests/apoyo/compradores";
import { existe, jpeg } from "@/tests/apoyo/imagenes";

/**
 * F5.9 — La foto de perfil: una sola versión, cuadrada, y sin huérfanos.
 *
 * Contra Storage de verdad, como los logos (`imagenes.test.ts`): lo que puede
 * salir mal es que la foto vieja quede en el bucket al cambiarla o al
 * quitarla, y eso un doble no lo muestra. La ruta que recibe el archivo no se
 * prueba acá —necesita sesión— sino en `tests/e2e/foto-de-perfil.spec.ts`.
 */

const sesion = vi.hoisted(() => ({ actual: null as unknown }));
vi.mock("@/lib/session", () => ({ getSession: async () => sesion.actual }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));
vi.mock("next/cache", () => ({ refresh: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));

const { procesarImagen } = await import("@/modules/media/procesar");
const { publicarFotoDePerfil, quitarFotoDePerfil, urlDeFotoDePerfil } =
  await import("@/modules/media/subir");
const { clave, TAMANOS_PERFIL } = await import("@/modules/media/tamanos");
const { caraDe } = await import("@/modules/users/avatar");
const { quitarMiFoto } = await import("@/modules/users/actions");

afterEach(() => {
  sesion.actual = null;
});

afterAll(async () => {
  await limpiarCompradores();
});

async function laClave(userId: string): Promise<string | null> {
  const [fila] = await db.execute<{ clave: string | null }>(sql`
    SELECT avatar_key AS clave FROM user_profiles WHERE id = ${userId}`);
  return fila.clave;
}

const archivo = (base: string) => clave(base, TAMANOS_PERFIL[0].sufijo);

describe("la conversión", () => {
  test("una foto vertical sale cuadrada, de 256px y en WEBP", async () => {
    const p = await procesarImagen(await jpeg(900, 1200, 90), TAMANOS_PERFIL);

    expect(p.versiones).toHaveLength(1);
    const [v] = p.versiones;
    expect(v.cuerpo.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect({ ancho: v.ancho, alto: v.alto }).toEqual({ ancho: 256, alto: 256 });
  });

  // Con `withoutEnlargement`, como las de producto, una foto chica salía con
  // su proporción y el círculo la deformaba.
  test("una foto más chica que 256px también sale cuadrada", async () => {
    const p = await procesarImagen(await jpeg(100, 200, 90), TAMANOS_PERFIL);
    const meta = await sharp(p.versiones[0].cuerpo).metadata();
    expect([meta.width, meta.height]).toEqual([256, 256]);
  });

  test("pesa una fracción de una foto de producto", async () => {
    const p = await procesarImagen(await jpeg(3000, 4000, 90), TAMANOS_PERFIL);
    // Con ruido aleatorio, que es el peor caso para cualquier compresor: una
    // foto de una cara pesa bastante menos.
    expect(p.versiones[0].bytes).toBeLessThan(60 * 1024);
  });
});

describe("publicar, cambiar y quitar", () => {
  test("se guarda la clave bajo `usuarios/{id}/`, no la URL", async () => {
    const yo = await unComprador();
    const { avatarKey } = await publicarFotoDePerfil({
      userId: yo.userId,
      archivo: await jpeg(600, 800),
    });

    expect(avatarKey.startsWith(`usuarios/${yo.userId}/`)).toBe(true);
    expect(await laClave(yo.userId)).toBe(avatarKey);
    expect(await existe(archivo(avatarKey))).toBe(true);

    await quitarFotoDePerfil(yo.userId);
  });

  test("cambiarla borra el archivo de la anterior", async () => {
    const yo = await unComprador();
    const primera = await publicarFotoDePerfil({
      userId: yo.userId,
      archivo: await jpeg(600, 800),
    });
    const segunda = await publicarFotoDePerfil({
      userId: yo.userId,
      archivo: await jpeg(600, 800),
    });

    expect(segunda.avatarKey).not.toBe(primera.avatarKey);
    expect(await existe(archivo(primera.avatarKey))).toBe(false);
    expect(await existe(archivo(segunda.avatarKey))).toBe(true);

    await quitarFotoDePerfil(yo.userId);
  });

  test("quitarla deja la columna en NULL y borra el archivo", async () => {
    const yo = await unComprador();
    const { avatarKey } = await publicarFotoDePerfil({
      userId: yo.userId,
      archivo: await jpeg(600, 800),
    });

    await quitarFotoDePerfil(yo.userId);

    expect(await laClave(yo.userId)).toBeNull();
    expect(await existe(archivo(avatarKey))).toBe(false);
  });

  test("quitar sin foto no hace nada", async () => {
    const yo = await unComprador();
    await expect(quitarFotoDePerfil(yo.userId)).resolves.toBeUndefined();
  });

  test("un archivo que no es imagen no deja nada", async () => {
    const yo = await unComprador();
    await expect(
      publicarFotoDePerfil({
        userId: yo.userId,
        archivo: Buffer.from("<html>no soy una foto</html>"),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await laClave(yo.userId)).toBeNull();
  });
});

describe("la cara que se muestra", () => {
  test("sin foto, un blobatar que no cambia entre una carga y otra", () => {
    const id = "6f1c2a9e-1b2c-4d5e-8f90-123456789abc";
    const cara = caraDe({ id, avatarKey: null });

    expect(cara.startsWith("data:image/svg+xml")).toBe(true);
    expect(caraDe({ id, avatarKey: null })).toBe(cara);
    // Otro id, otra cara.
    expect(caraDe({ id: id.replace("6f", "7f"), avatarKey: null })).not.toBe(
      cara,
    );
  });

  test("con foto, la URL pública de su única versión", () => {
    const base = "usuarios/x/y";
    expect(caraDe({ id: "x", avatarKey: base })).toBe(urlDeFotoDePerfil(base));
    expect(urlDeFotoDePerfil(base)).toMatch(/usuarios\/x\/y-avatar\.webp$/);
  });
});

describe("«Quitar foto» desde «Mis datos»", () => {
  function comoSesion(userId: string, bajaPedida: boolean) {
    sesion.actual = {
      identity: { userId, email: "yo@ejemplo.test", emailVerified: true },
      role: "customer",
      profile: {
        id: userId,
        isBanned: false,
        banReason: null,
        closureRequestedAt: bajaPedida ? new Date() : null,
        closedAt: null,
      },
    };
  }

  test("quita la foto de la cuenta de la sesión", async () => {
    const yo = await unComprador();
    await publicarFotoDePerfil({ userId: yo.userId, archivo: await jpeg() });
    comoSesion(yo.userId, false);

    expect(await quitarMiFoto({})).toMatchObject({ ok: true });
    expect(await laClave(yo.userId)).toBeNull();
  });

  // Con la baja pedida la cuenta es de solo lectura (RF-34): la foto también.
  test("con la baja pedida no se puede", async () => {
    const yo = await unComprador();
    await publicarFotoDePerfil({ userId: yo.userId, archivo: await jpeg() });
    comoSesion(yo.userId, true);

    expect(await quitarMiFoto({})).toMatchObject({
      ok: false,
      code: "ACCOUNT_CLOSURE_PENDING",
    });
    expect(await laClave(yo.userId)).not.toBeNull();

    await quitarFotoDePerfil(yo.userId);
  });

  test("sin sesión no se puede", async () => {
    expect(await quitarMiFoto({})).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});
