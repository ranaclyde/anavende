import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

/**
 * Lo que la guardia de ruta necesita saber del bloqueo — FS RF-27 · TS §13.5.
 * Tarea F7.7.
 *
 * **Por qué hace falta una consulta acá.** Bloquear en Supabase Auth corta el
 * refresco del token —medido el 2026-09-16: `user_banned` al canjearlo, y
 * también al pedir el usuario—, pero **nuestro token se verifica localmente**
 * contra el JWKS (§13.3) y un JWT firmado sigue siendo válido hasta que vence.
 * Así que sin esto, alguien recién bloqueado no puede hacer nada —toda Server
 * Action relee el perfil— y sin embargo sigue viendo sus pantallas durante lo
 * que le quede de token, hasta una hora. RF-27 pide que las sesiones activas
 * se invaliden, y ésta es la única capa que puede hacerlo cumplir.
 *
 * **Ante la duda, NO está bloqueada.** Si la base no contesta, el que paga es
 * quien no hizo nada: dejar a toda la tienda afuera de su cuenta por un corte
 * de la LAN es peor que la hora de gracia que esto viene a cerrar. Mismo
 * criterio que el interruptor de mantenimiento, al revés en el signo y por el
 * mismo motivo: el error se inclina hacia donde hace menos daño.
 */
export async function estaBloqueado(userId: string): Promise<boolean> {
  try {
    const [perfil] = await db
      .select({ isBanned: userProfiles.isBanned })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1);

    return perfil?.isBanned === true;
  } catch (error) {
    console.error("[bloqueo] No se pudo leer el estado de la cuenta.", error);
    return false;
  }
}
