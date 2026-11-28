import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { ObjectStorage } from "@/lib/storage";

/**
 * Errores comunes y no de dominio a propósito: son incidentes y van a Sentry.
 */
export function crearAlmacenamientoSupabase(): ObjectStorage {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("Falta SUPABASE_STORAGE_BUCKET.");
  }

  const cliente = createServiceClient().storage.from(bucket);

  return {
    async put(key, body, contentType) {
      // `upsert` a propósito: las claves son UUID nuevos, así que una colisión
      // solo puede ser un reintento de la misma subida.
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

    async get(key) {
      const { data, error } = await cliente.download(key);
      if (error) {
        throw new Error(`No se pudo leer «${key}»: ${error.message}`, {
          cause: error,
        });
      }
      return Buffer.from(await data.arrayBuffer());
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
