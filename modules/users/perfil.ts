import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

/**
 * «Mis datos» — RF-07. Tarea F5.2.
 *
 * Recibe el `userId` de la sesión y nunca de la entrada (§13.8): sin RLS, que
 * el `WHERE` salga de la sesión es la única barrera entre una cuenta y otra.
 *
 * **El email no está, y a propósito.** Es la identidad con la que se entra, la
 * guarda GoTrue, y cambiarlo exige confirmar la dirección nueva con un email
 * que RF-30 no tiene. Esta tabla guarda una copia para listar y buscar; si se
 * la dejara editar, se desincronizaría de la de verdad.
 */
export async function actualizarDatos(
  userId: string,
  datos: { firstName: string; lastName: string; phone: string },
): Promise<void> {
  await db
    .update(userProfiles)
    .set({ ...datos, updatedAt: sql`now()` })
    .where(eq(userProfiles.id, userId));
}
