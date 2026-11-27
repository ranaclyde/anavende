import "server-only";

import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { publicarFotoDePerfil } from "@/modules/media/subir";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * La foto y el nombre de Google, solo en el alta. Va en dos tiempos porque la
 * cuenta no tiene perfil hasta `/completar-perfil`: en la vuelta de Google se
 * anotan en `app_metadata`, y al crear el perfil se baja la foto y se borran.
 *
 * Se usa la API de People porque la `picture` del ingreso no distingue la
 * inicial genérica que inventa Google; People la marca `default`. GoTrue no
 * guarda `given_name` ni `family_name`.
 *
 * En `app_metadata` y no en `user_metadata`, que la escribe el propio usuario:
 * podría poner ahí cualquier dirección para que el servidor la baje. Por lo
 * mismo se acepta solo un host de Google.
 */

const FOTO = "foto_de_google";
const NOMBRE = "nombre_de_google";
const APELLIDO = "apellido_de_google";

const ESPERA_MS = 5_000;

export type DatosDeGoogle = {
  foto: string | null;
  nombre: string | null;
  apellido: string | null;
};

const NADA: DatosDeGoogle = { foto: null, nombre: null, apellido: null };

/** People da 100px y se guarda en 256: se pide en 512 (`=s100` al final). */
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

function limpio(texto: string | undefined): string | null {
  const t = texto?.trim().replace(/\s+/g, " ");
  return t ? t : null;
}

type ConMetadata = { metadata?: { primary?: boolean } };

function principal<T extends ConMetadata>(lista: T[]): T | undefined {
  return lista.find((x) => x.metadata?.primary) ?? lista[0];
}

type RespuestaDePeople = {
  names?: (ConMetadata & { givenName?: string; familyName?: string })[];
  photos?: (ConMetadata & { url?: string; default?: boolean })[];
};

/** Lo que no se pudo saber —o una foto que no eligió— vuelve en `null`. */
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

export async function anotarDatosDeGoogle(
  userId: string,
  tokenDeGoogle: string,
): Promise<void> {
  const datos = await leerDeGoogle(tokenDeGoogle);
  if (!datos.foto && !datos.nombre && !datos.apellido) return;

  try {
    await anotar(userId, datos);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { capa: "auth-callback", paso: "datos-de-google" },
    });
  }
}

export async function nombreDeGoogle(
  userId: string,
): Promise<{ nombre: string; apellido: string } | null> {
  const datos = await anotados(userId);
  if (!datos?.nombre) return null;
  return { nombre: datos.nombre, apellido: datos.apellido ?? "" };
}

/**
 * Devuelve si quedó la foto. No lanza nunca: el perfil ya está guardado.
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

      // sharp rechaza lo que no sea una imagen, como en una foto subida.
      await publicarFotoDePerfil({ userId, archivo });
      guardada = true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { capa: "server-action", paso: "datos-de-google" },
      });
    }
  }

  // Se borran salga como salga: la cuenta ya tiene perfil y no vuelve acá.
  await anotar(userId, NADA).catch((error: unknown) => {
    Sentry.captureException(error, {
      tags: { capa: "server-action", paso: "datos-de-google" },
    });
  });

  return guardada;
}
