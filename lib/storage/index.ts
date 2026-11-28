import "server-only";

import { crearAlmacenamientoSupabase } from "@/lib/storage/supabase";

/**
 * TECHNICAL-SPEC §9.4: el resto del código maneja claves, nunca URLs ni SDKs.
 * Interfaz chica a propósito: cada método es algo que otro backend tendrá que
 * tener.
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

let instancia: ObjectStorage | null = null;

// Tarde y no al importar: si no, cualquier módulo que lo importe exigiría las
// variables de entorno aunque no suba nada.
export function almacenamiento(): ObjectStorage {
  instancia ??= crearAlmacenamientoSupabase();
  return instancia;
}
