import "server-only";

import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { publicarFotoDePerfil } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * Lo que se trae de Google al darse de alta — F1.7 y F5.9, pedidos tuyos del
 * 2026-10-26: la **foto**, como primera foto de perfil, y el **nombre y el
 * apellido por separado**, para precargar `/completar-perfil`.
 *
 * **La foto se procesa y se guarda como cualquier otra** (la misma versión
 * cuadrada de 256px en Storage), y no como un enlace a los servidores de
 * Google: así se cambia y se quita desde «Mis datos» como una foto subida, y
 * no desaparece si la cambia allá. Si no tiene foto, o algo falla, queda su
 * blobatar.
 *
 * **El nombre y el apellido, de Google y no adivinados.** GoTrue guarda de
 * Google solo el nombre completo —en la v2.184.0, `parseGoogleIDToken` tira
 * `given_name` y `family_name`—, y partirlo en el primer espacio deja a
 * «Juan Pablo Pérez» con nombre «Juan» y apellido «Pablo Pérez». Si Google no
 * los da, `/completar-perfil` sigue partiendo el nombre completo, como antes.
 *
 * **Va en dos tiempos**, porque todo esto vive en el perfil y una cuenta de
 * Google no tiene perfil hasta `/completar-perfil`:
 *
 *   1. En la vuelta de Google (`/api/auth/callback`), con el permiso que
 *      Google acaba de dar, se le pregunta a la API de People —una sola
 *      consulta, nombres y fotos— y lo que diga se anota en `app_metadata`
 *      de GoTrue.
 *   2. `/completar-perfil` lee el nombre y el apellido para precargarlos, y
 *      al crear el perfil (`completarPerfil`) se baja la foto, se procesa y
 *      se borran las anotaciones.
 *
 * **Por qué la API de People y no la `picture` que ya trae el ingreso**: a
 * quien no subió ninguna foto, Google le inventa una —la inicial sobre un
 * color— y la `picture` no lo distingue. People sí: la marca `default`. Sin
 * eso, «si no tiene foto, el blobatar» no se podría cumplir. Necesita la API
 * de People prendida en el proyecto de Google Cloud; si no lo está, responde
 * 403, la cuenta queda con su blobatar y el nombre se parte como antes.
 *
 * **En `app_metadata` y no en `user_metadata`**: la segunda la escribe el
 * propio usuario, y alguien podría poner ahí la dirección que quisiera para
 * que el servidor la baje. Por lo mismo se acepta solo un host de Google.
 *
 * **Solo en el alta.** A una cuenta que ya existía y vincula Google no se le
 * toca nada: si quitó la foto, la quitó a propósito.
 */

const FOTO = "foto_de_google";
const NOMBRE = "nombre_de_google";
const APELLIDO = "apellido_de_google";

/** Lo que tarda como mucho cada pedido a Google antes de rendirse. */
const ESPERA_MS = 5_000;

export type DatosDeGoogle = {
  foto: string | null;
  nombre: string | null;
  apellido: string | null;
};

const NADA: DatosDeGoogle = { foto: null, nombre: null, apellido: null };

/**
 * Pide la foto en 512px: la que da People es de 100, y la versión guardada es
 * de 256. Las direcciones de Google llevan el tamaño al final (`=s100`).
 */
function enTamano(url: string): string {
  return /=s\d+(-c)?$/.test(url)
    ? url.replace(/=s\d+(-c)?$/, "=s512-c")
    : `${url}=s512-c`;
}

/** Solo fotos servidas por Google, y por HTTPS. */
export function esFotoDeGoogle(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      (hostname === "googleusercontent.com" ||
        hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

/** Sin espacios de más, y `null` si no queda nada. */
function limpio(texto: string | undefined): string | null {
  const t = texto?.trim().replace(/\s+/g, " ");
  return t ? t : null;
}

type ConMetadata = { metadata?: { primary?: boolean } };

/** La que la persona marcó como principal, o la primera. */
function principal<T extends ConMetadata>(lista: T[]): T | undefined {
  return lista.find((x) => x.metadata?.primary) ?? lista[0];
}

type RespuestaDePeople = {
  names?: (ConMetadata & { givenName?: string; familyName?: string })[];
  photos?: (ConMetadata & { url?: string; default?: boolean })[];
};

/**
 * Lo que Google sabe de la persona. Lo que no se pudo saber —o una foto que
 * no eligió ella— vuelve en `null`.
 */
export async function leerDeGoogle(
  tokenDeGoogle: string,
): Promise<DatosDeGoogle> {
  try {
    const respuesta = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=names,photos",
      {
        headers: { Authorization: `Bearer ${tokenDeGoogle}` },
        cache: "no-store",
        signal: AbortSignal.timeout(ESPERA_MS),
      },
    );
    if (!respuesta.ok) {
      throw new Error(`People respondió ${respuesta.status}`);
    }

    const { names = [], photos = [] } =
      (await respuesta.json()) as RespuestaDePeople;

    const nombre = principal(names);
    const foto = principal(photos);
    const fotoElegida =
      foto?.url && !foto.default && esFotoDeGoogle(foto.url)
        ? enTamano(foto.url)
        : null;

    return {
      foto: fotoElegida,
      nombre: limpio(nombre?.givenName),
      apellido: limpio(nombre?.familyName),
    };
  } catch (error) {
    console.error("[datos-de-google] No se pudo leer a la persona.", error);
    return NADA;
  }
}

async function anotar(userId: string, datos: DatosDeGoogle): Promise<void> {
  const { error } = await createServiceClient().auth.admin.updateUserById(
    userId,
    {
      app_metadata: {
        [FOTO]: datos.foto,
        [NOMBRE]: datos.nombre,
        [APELLIDO]: datos.apellido,
      },
    },
  );
  if (error) throw error;
}

async function anotados(userId: string): Promise<DatosDeGoogle | null> {
  const { data, error } =
    await createServiceClient().auth.admin.getUserById(userId);
  if (error) return null;
  const app = data.user?.app_metadata ?? {};
  const texto = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    foto: texto(app[FOTO]),
    nombre: texto(app[NOMBRE]),
    apellido: texto(app[APELLIDO]),
  };
}

/** Paso 1: en la vuelta de Google, para una cuenta sin perfil. */
export async function anotarDatosDeGoogle(
  userId: string,
  tokenDeGoogle: string,
): Promise<void> {
  const datos = await leerDeGoogle(tokenDeGoogle);
  if (!datos.foto && !datos.nombre && !datos.apellido) return;

  try {
    await anotar(userId, datos);
  } catch (error) {
    // Sin la anotación, blobatar y el nombre partido: nada que frenar.
    Sentry.captureException(error, {
      tags: { capa: "auth-callback", paso: "datos-de-google" },
    });
  }
}

/**
 * Paso 2a: el nombre y el apellido para precargar `/completar-perfil`, o
 * `null` si Google no dio el nombre.
 */
export async function nombreDeGoogle(
  userId: string,
): Promise<{ nombre: string; apellido: string } | null> {
  const datos = await anotados(userId);
  if (!datos?.nombre) return null;
  return { nombre: datos.nombre, apellido: datos.apellido ?? "" };
}

/**
 * Paso 2b: con el perfil recién creado, la foto, y las anotaciones se van.
 * Devuelve si quedó la foto. **No lanza nunca**: el perfil ya está guardado,
 * y una foto que no se pudo traer no es motivo para decirle a nadie «no
 * pudimos».
 */
export async function importarFotoDeGoogle(userId: string): Promise<boolean> {
  const datos = await anotados(userId);
  if (!datos || (!datos.foto && !datos.nombre && !datos.apellido)) return false;

  let guardada = false;
  if (datos.foto) {
    try {
      if (!esFotoDeGoogle(datos.foto)) {
        throw new Error("La dirección no es de Google.");
      }

      const respuesta = await fetch(datos.foto, {
        cache: "no-store",
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      if (!respuesta.ok) {
        throw new Error(`Google respondió ${respuesta.status}`);
      }
      // Si Google redirige, el destino también tiene que ser suyo.
      if (!esFotoDeGoogle(respuesta.url)) {
        throw new Error("La foto terminó fuera de Google.");
      }

      const archivo = Buffer.from(await respuesta.arrayBuffer());
      if (archivo.byteLength > TAMANO_MAXIMO) {
        throw new Error("La foto es demasiado grande.");
      }

      // La misma conversión que una foto subida, magic bytes incluidos: si
      // Google devolviera otra cosa que una imagen, sharp la rechaza acá.
      await publicarFotoDePerfil({ userId, archivo });
      guardada = true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { capa: "server-action", paso: "datos-de-google" },
      });
    }
  }

  // Se borran salga como salga: un segundo intento no tiene por qué andar
  // mejor, y la cuenta ya tiene perfil, así que no vuelve a pasar por acá.
  await anotar(userId, NADA).catch((error: unknown) => {
    Sentry.captureException(error, {
      tags: { capa: "server-action", paso: "datos-de-google" },
    });
  });

  return guardada;
}
