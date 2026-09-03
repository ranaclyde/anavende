import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { ObjectStorage } from "@/lib/storage";

/**
 * Adaptador de Supabase Storage — TECHNICAL-SPEC §9.4.
 *
 * Es el ÚNICO archivo del proyecto que sabe cómo se guarda un objeto. Se
 * accede siempre con la clave de servicio y desde el servidor: el navegador
 * nunca escribe en Storage, solo lee del subdominio público.
 *
 * Los errores se propagan como errores comunes, no como errores de dominio.
 * Que Storage no responda no es una regla de negocio: es un incidente, y el
 * envoltorio de §6.2 lo manda a Sentry, que es donde tiene que verse.
 */
export function crearAlmacenamientoSupabase(): ObjectStorage {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("Falta SUPABASE_STORAGE_BUCKET.");
  }

  const cliente = createServiceClient().storage.from(bucket);

  return {
    async put(key, body, contentType) {
      // `upsert` a propósito: las claves las genera el servidor con un UUID
      // nuevo (§9.2), así que una colisión solo puede venir de un reintento
      // de la MISMA subida. Sobrescribir es lo correcto ahí; fallar dejaría
      // la mitad de los tamaños de un intento y la mitad del otro.
      const { error } = await cliente.upload(key, body, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(`No se pudo guardar «${key}»: ${error.message}`, {
          cause: error,
        });
      }
    },

    async delete(key) {
      const { error } = await cliente.remove([key]);
      if (error) {
        throw new Error(`No se pudo borrar «${key}»: ${error.message}`, {
          cause: error,
        });
      }
    },

    publicUrl(key) {
      return cliente.getPublicUrl(key).data.publicUrl;
    },
  };
}
