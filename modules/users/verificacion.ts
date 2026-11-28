import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Se lee de `auth.users` y no de la sesión a propósito: en esta versión de
 * GoTrue el token trae `email_verified` solo en `user_metadata`, que el propio
 * usuario puede escribir con `updateUser({ data })`. Para un aviso alcanza la
 * sesión; para dejar confirmar un pedido, no.
 */
export async function emailConfirmado(userId: string): Promise<boolean> {
  const [fila] = await db.execute<{ confirmado: boolean }>(sql`
    SELECT email_confirmed_at IS NOT NULL AS confirmado
      FROM auth.users WHERE id = ${userId}`);
  return fila?.confirmado === true;
}
