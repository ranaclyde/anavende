import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";

import { db } from "@/db";
import { createServiceClient } from "@/lib/supabase/service";
import { jpeg } from "@/tests/apoyo/imagenes";

/**
 * F1.7 y F5.9 — Lo que se trae de Google al darse de alta: la foto, como
 * primera foto de perfil, y el nombre y el apellido por separado.
 *
 * Lo que habla con Google se prueba reemplazando `fetch` solo para las
 * direcciones de Google: el resto —Storage y GoTrue del stack local— es de
 * verdad, porque lo que puede salir mal es que la foto no quede guardada, o
 * que la anotación quede colgada en la cuenta.
 */

vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

const {
  anotarDatosDeGoogle,
  esFotoDeGoogle,
  importarFotoDeGoogle,
  leerDeGoogle,
  nombreDeGoogle,
} = await import("@/modules/users/datos-de-google");
const { quitarFotoDePerfil } = await import("@/modules/media/subir");

const FOTO = "https://lh3.googleusercontent.com/a/ACg8ocFoto=s100";
const fetchReal = globalThis.fetch;

/** Responde por Google; lo demás pasa al `fetch` de verdad. */
function google(responder: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada instanceof Request ? entrada.url : entrada);
      if (!/googleapis\.com|googleusercontent\.com/.test(url)) {
        return fetchReal(entrada, init);
      }
      const respuesta = await responder(url);
      Object.defineProperty(respuesta, "url", { value: url });
      return respuesta;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const creadas: string[] = [];

afterAll(async () => {
  for (const id of creadas.splice(0)) {
    await createServiceClient().auth.admin.deleteUser(id);
  }
});

/**
 * Una cuenta creada por la API de GoTrue, con su perfil: la foto se anota en
 * `app_metadata`, y GoTrue no carga las cuentas que `unComprador` inserta a
 * mano en `auth.users`.
 */
async function unaCuenta(): Promise<{ userId: string }> {
  const { data, error } = await createServiceClient().auth.admin.createUser({
    email: `google-${randomUUID().slice(0, 8)}@ejemplo.test`,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  creadas.push(userId);
  await db.execute(sql`
    INSERT INTO user_profiles (id, first_name, last_name, email, phone)
    VALUES (${userId}, 'Compradora', 'Google', ${data.user.email}, '+5492920000000')`);
  return { userId };
}

describe("esFotoDeGoogle", () => {
  test.each([
    [FOTO, true],
    ["https://googleusercontent.com/x", true],
    ["http://lh3.googleusercontent.com/a/x", false],
    ["https://googleusercontent.com.otro.net/x", false],
    ["https://otro.net/googleusercontent.com", false],
    ["no es una dirección", false],
  ])("%s → %s", (url, esperado) => {
    expect(esFotoDeGoogle(url)).toBe(esperado);
  });
});

describe("leerDeGoogle", () => {
  const people = (cuerpo: unknown, status = 200) =>
    google(() => Response.json(cuerpo, { status }));

  test("la foto elegida, pedida en 512px, y el nombre y el apellido por separado", async () => {
    people({
      names: [
        {
          givenName: "Juan Pablo",
          familyName: "Pérez",
          metadata: { primary: true },
        },
      ],
      photos: [{ url: FOTO, metadata: { primary: true } }],
    });
    expect(await leerDeGoogle("token")).toEqual({
      foto: "https://lh3.googleusercontent.com/a/ACg8ocFoto=s512-c",
      nombre: "Juan Pablo",
      apellido: "Pérez",
    });
  });

  test("toma el nombre principal, no el primero", async () => {
    people({
      names: [
        { givenName: "Viejo", familyName: "Nombre" },
        {
          givenName: "María",
          familyName: "Gómez",
          metadata: { primary: true },
        },
      ],
    });
    expect(await leerDeGoogle("token")).toMatchObject({
      nombre: "María",
      apellido: "Gómez",
    });
  });

  test("sin apellido, solo el nombre, y sin espacios de más", async () => {
    people({ names: [{ givenName: "  Ana  ", metadata: { primary: true } }] });
    expect(await leerDeGoogle("token")).toEqual({
      foto: null,
      nombre: "Ana",
      apellido: null,
    });
  });

  test("la inicial que inventa Google no cuenta como foto", async () => {
    people({
      photos: [{ url: FOTO, default: true, metadata: { primary: true } }],
    });
    expect((await leerDeGoogle("token")).foto).toBeNull();
  });

  test("sin fotos ni nombres, nada", async () => {
    people({});
    expect(await leerDeGoogle("token")).toEqual({
      foto: null,
      nombre: null,
      apellido: null,
    });
  });

  test("una dirección fuera de Google se descarta", async () => {
    people({
      photos: [
        { url: "https://otro.net/foto.jpg", metadata: { primary: true } },
      ],
    });
    expect((await leerDeGoogle("token")).foto).toBeNull();
  });

  test("con la API de People apagada (403), nada", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    people({}, 403);
    expect(await leerDeGoogle("token")).toEqual({
      foto: null,
      nombre: null,
      apellido: null,
    });
  });
});

describe("anotar y leer el nombre", () => {
  test("lo que dice Google queda anotado y sale para el formulario", async () => {
    const yo = await unaCuenta();
    google(() =>
      Response.json({
        names: [
          {
            givenName: "Juan Pablo",
            familyName: "Pérez",
            metadata: { primary: true },
          },
        ],
      }),
    );
    await anotarDatosDeGoogle(yo.userId, "token");
    expect(await nombreDeGoogle(yo.userId)).toEqual({
      nombre: "Juan Pablo",
      apellido: "Pérez",
    });
  });

  test("sin nombre de Google, el formulario parte el nombre completo", async () => {
    const yo = await unaCuenta();
    expect(await nombreDeGoogle(yo.userId)).toBeNull();
  });

  test("al completar el perfil, el nombre anotado también se va", async () => {
    const yo = await unaCuenta();
    google(() =>
      Response.json({
        names: [
          { givenName: "Ana", familyName: "Ruiz", metadata: { primary: true } },
        ],
      }),
    );
    await anotarDatosDeGoogle(yo.userId, "token");

    expect(await importarFotoDeGoogle(yo.userId)).toBe(false);
    expect(await nombreDeGoogle(yo.userId)).toBeNull();
  });
});

describe("importarFotoDeGoogle", () => {
  async function anotada(userId: string, url: string | null) {
    const { error } = await createServiceClient().auth.admin.updateUserById(
      userId,
      { app_metadata: { foto_de_google: url } },
    );
    if (error) throw error;
  }

  async function estado(userId: string) {
    const [fila] = await db.execute<{ clave: string | null }>(sql`
      SELECT avatar_key AS clave FROM user_profiles WHERE id = ${userId}`);
    const { data } = await createServiceClient().auth.admin.getUserById(userId);
    return {
      clave: fila.clave,
      anotacion: data.user?.app_metadata?.foto_de_google ?? null,
    };
  }

  test("baja la foto, la guarda como foto de perfil y borra la anotación", async () => {
    const yo = await unaCuenta();
    await anotada(yo.userId, FOTO);
    const imagen = await jpeg(512, 512);
    google(() => new Response(new Uint8Array(imagen)));

    expect(await importarFotoDeGoogle(yo.userId)).toBe(true);

    const { clave, anotacion } = await estado(yo.userId);
    expect(clave?.startsWith(`usuarios/${yo.userId}/`)).toBe(true);
    expect(anotacion).toBeNull();

    await quitarFotoDePerfil(yo.userId);
  });

  test("si Google no devuelve una imagen, blobatar, y la anotación se va igual", async () => {
    const yo = await unaCuenta();
    await anotada(yo.userId, FOTO);
    google(() => new Response("<html>no</html>"));

    expect(await importarFotoDeGoogle(yo.userId)).toBe(false);
    expect(await estado(yo.userId)).toEqual({ clave: null, anotacion: null });
  });

  test("si Google no contesta, blobatar", async () => {
    const yo = await unaCuenta();
    await anotada(yo.userId, FOTO);
    google(() => new Response(null, { status: 404 }));

    expect(await importarFotoDeGoogle(yo.userId)).toBe(false);
    expect(await estado(yo.userId)).toEqual({ clave: null, anotacion: null });
  });

  test("una dirección anotada fuera de Google no se baja", async () => {
    const yo = await unaCuenta();
    await anotada(yo.userId, "https://otro.net/foto.jpg");
    const pedido = vi.fn(fetchReal);
    vi.stubGlobal("fetch", pedido);

    expect(await importarFotoDeGoogle(yo.userId)).toBe(false);
    expect(
      pedido.mock.calls.some(([u]) => String(u).includes("otro.net")),
    ).toBe(false);
    expect(await estado(yo.userId)).toEqual({ clave: null, anotacion: null });
  });

  test("sin anotación no hace nada", async () => {
    const yo = await unaCuenta();
    expect(await importarFotoDeGoogle(yo.userId)).toBe(false);
    expect((await estado(yo.userId)).clave).toBeNull();
  });
});
