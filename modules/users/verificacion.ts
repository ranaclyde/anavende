import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * ¿Verificó el email? Leído de `auth.users`, que es lo que escribe GoTrue al
 * confirmar el enlace — F10.5, RF-11.
 *
 * **No sale de la sesión a propósito.** En esta versión de GoTrue el token
 * trae `email_verified` solo dentro de `user_metadata`, y ese bloque lo puede
 * escribir el propio usuario con `supabase.auth.updateUser({ data })`:
 * comprobado en el stack local el 2026-10-17. Para mostrar un aviso alcanza
 * con la sesión (`identity.emailVerified`); para dejar confirmar un pedido,
 * no.
 */
export async function emailConfirmado(userId: string): Promise<boolean> {
  const [fila] = await db.execute<{ confirmado: boolean }>(sql`
    SELECT email_confirmed_at IS NOT NULL AS confirmado
      FROM auth.users WHERE id = ${userId}`);
  return fila?.confirmado === true;
}
