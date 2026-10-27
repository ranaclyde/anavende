import "server-only";

import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { publicarFotoDePerfil } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * La foto de Google como primera foto de perfil — F1.7 y F5.9, pedido tuyo
 * del 2026-10-26.
 *
 * Quien se da de alta con Google empieza con su foto de Google, **procesada y
 * guardada como cualquier otra** (la misma versión cuadrada de 256px en
 * Storage), y no con un enlace a los servidores de Google: así se cambia y se
 * quita desde «Mis datos» como una foto subida, y no desaparece si la cambia
 * allá. Si no tiene foto, o algo falla, queda su blobatar.
 *
 * **Va en dos tiempos**, porque la foto vive en el perfil y una cuenta de
 * Google no tiene perfil hasta `/completar-perfil`:
 *
 *   1. En la vuelta de Google (`/api/auth/callback`), con el permiso que
 *      Google acaba de dar, se le pregunta a la API de People cuál es la foto,
 *      y su dirección se anota en `app_metadata` de GoTrue.
 *   2. Al crear el perfil (`completarPerfil`), se baja, se procesa y se borra
 *      la anotación.
 *
 * **Por qué la API de People y no la `picture` que ya trae el ingreso**: a
 * quien no subió ninguna foto, Google le inventa una —la inicial sobre un
 * color— y la `picture` no lo distingue. People sí: la marca `default`. Sin
 * eso, «si no tiene foto, el blobatar» no se podría cumplir. Necesita la API
 * de People prendida en el proyecto de Google Cloud; si no lo está, responde
 * 403 y la cuenta queda con su blobatar.
 *
 * **En `app_metadata` y no en `user_metadata`**: la segunda la escribe el
 * propio usuario, y alguien podría poner ahí la dirección que quisiera para
 * que el servidor la baje. Por lo mismo se acepta solo un host de Google.
 *
 * **Solo en el alta.** A una cuenta que ya existía y vincula Google no se le
 * toca la foto: si la quitó, la quitó a propósito.
 */

const CLAVE = "foto_de_google";

/** Lo que tarda como mucho cada pedido a Google antes de rendirse. */
const ESPERA_MS = 5_000;

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

type RespuestaDePeople = {
  photos?: {
    url?: string;
    default?: boolean;
    metadata?: { primary?: boolean };
  }[];
};

/**
 * La dirección de la foto que eligió la persona, o `null` si no eligió
 * ninguna o no se pudo saber.
 */
export async function buscarFotoDeGoogle(
  tokenDeGoogle: string,
): Promise<string | null> {
  try {
    const respuesta = await fetch(
      "https://people.googleapis.com/v1/people/me?personFields=photos",
      {
        headers: { Authorization: `Bearer ${tokenDeGoogle}` },
        cache: "no-store",
        signal: AbortSignal.timeout(ESPERA_MS),
      },
    );
    if (!respuesta.ok) {
      throw new Error(`People respondió ${respuesta.status}`);
    }

    const { photos = [] } = (await respuesta.json()) as RespuestaDePeople;
    const foto = photos.find((f) => f.metadata?.primary) ?? photos[0];
    if (!foto?.url || foto.default || !esFotoDeGoogle(foto.url)) return null;
    return enTamano(foto.url);
  } catch (error) {
    console.error("[foto-de-google] No se pudo leer la foto.", error);
    return null;
  }
}

async function anotar(userId: string, url: string | null): Promise<void> {
  const { error } = await createServiceClient().auth.admin.updateUserById(
    userId,
    { app_metadata: { [CLAVE]: url } },
  );
  if (error) throw error;
}

/** Paso 1: en la vuelta de Google, para una cuenta sin perfil. */
export async function anotarFotoDeGoogle(
  userId: string,
  tokenDeGoogle: string,
): Promise<void> {
  const url = await buscarFotoDeGoogle(tokenDeGoogle);
  if (!url) return;

  try {
    await anotar(userId, url);
  } catch (error) {
    // Sin la anotación, la cuenta queda con su blobatar: nada que frenar.
    Sentry.captureException(error, {
      tags: { capa: "auth-callback", paso: "foto-de-google" },
    });
  }
}

/**
 * Paso 2: con el perfil recién creado. Devuelve si quedó la foto. **No
 * lanza nunca**: el perfil ya está guardado, y una foto que no se pudo traer
 * no es motivo para decirle a nadie «no pudimos».
 */
export async function importarFotoDeGoogle(userId: string): Promise<boolean> {
  const servicio = createServiceClient();
  const { data, error } = await servicio.auth.admin.getUserById(userId);
  const url = data?.user?.app_metadata?.[CLAVE];
  if (error || typeof url !== "string") return false;

  let guardada = false;
  try {
    if (!esFotoDeGoogle(url)) throw new Error("La dirección no es de Google.");

    const respuesta = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ESPERA_MS),
    });
    if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status}`);
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
      tags: { capa: "server-action", paso: "foto-de-google" },
    });
  }

  // Se borra salga como salga: un segundo intento no tiene por qué andar
  // mejor, y la cuenta ya tiene perfil, así que no vuelve a pasar por acá.
  await anotar(userId, null).catch((error: unknown) => {
    Sentry.captureException(error, {
      tags: { capa: "server-action", paso: "foto-de-google" },
    });
  });

  return guardada;
}
