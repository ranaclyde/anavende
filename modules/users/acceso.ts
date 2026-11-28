import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

/**
 * Bloqueo o baja ejecutada: el proxy cierra la sesión en los dos casos. Hace
 * falta porque el JWT se verifica localmente y sigue valiendo hasta que vence
 * (TECHNICAL-SPEC §13.3, §13.5). Si la base falla, devuelve `false` a
 * propósito: dejar a todos afuera es peor que la hora de gracia.
 */
export async function tieneElAccesoCortado(userId: string): Promise<boolean> {
  try {
    const [perfil] = await db
      .select({
        isBanned: userProfiles.isBanned,
        closedAt: userProfiles.closedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1);

    return perfil?.isBanned === true || perfil?.closedAt != null;
  } catch (error) {
    console.error("[acceso] No se pudo leer el estado de la cuenta.", error);
    return false;
  }
}
