import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

/**
 * `userId` sale de la sesión y nunca de la entrada (§13.8): sin RLS, es la
 * única barrera entre una cuenta y otra. El email no se edita acá: lo guarda
 * GoTrue y esta tabla tiene solo una copia.
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
