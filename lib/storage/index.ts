import "server-only";

import { crearAlmacenamientoSupabase } from "@/lib/storage/supabase";

/**
 * Almacenamiento de objetos — TECHNICAL-SPEC §9.4.
 *
 * El resto del código maneja CLAVES, nunca URLs ni SDKs. Solo el adaptador
 * sabe que del otro lado hay Supabase Storage: si mañana se cambia por S3 o
 * por un disco, se reescribe un archivo y nada más.
 *
 * Por eso la interfaz es deliberadamente chica. Cada método que se le agregue
 * es una capacidad que el próximo backend tendrá que tener.
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

let instancia: ObjectStorage | null = null;

/**
 * El adaptador se crea una sola vez y tarde: construirlo al importar haría
 * que cualquier módulo que toque almacenamiento exija las variables de
 * entorno, incluso en un camino que no sube nada (§18.3).
 */
export function almacenamiento(): ObjectStorage {
  instancia ??= crearAlmacenamientoSupabase();
  return instancia;
}
