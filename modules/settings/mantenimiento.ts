import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

/**
 * Modo mantenimiento — F2.7b (DEVELOPMENT-PLAN), RF-20.
 *
 * La tienda queda fuera de servicio para el público mientras se carga el
 * catálogo, y **normal para quien administra**, que necesita mirar cada ficha
 * como la va a ver un comprador: es el motivo entero de la tarea.
 *
 * Lo usa `lib/supabase/proxy.ts` en cada pedido, así que todo acá está
 * ordenado para que casi ningún pedido pague una consulta: primero la ruta,
 * que es gratis; después el interruptor, que se recuerda unos segundos; y
 * recién al final el rol, que solo se pregunta con la tienda cerrada y una
 * sesión abierta.
 *
 * **No lleva `server-only`**, como `db/index.ts`: lo importa `proxy.ts`, que no
 * es un Server Component, y ese paquete es para el grafo de React del
 * servidor. Lo que lo mantiene lejos del navegador es que ningún componente de
 * cliente lo importa.
 */

/**
 * Lo que pasa SIEMPRE, con la tienda abierta o cerrada. Cada una tiene su
 * motivo, y ninguna es una comodidad:
 *
 *   · `/admin` — tiene su propia guardia de rol (F1.7c), y es desde donde se
 *     apaga esto.
 *   · `/ingresar`, `/recuperar`, `/completar-perfil`, `/error` — si la
 *     administradora está deslogueada y no puede entrar, la única salida es un
 *     UPDATE a mano en la base. **`/registro` NO está**: cerrarlo lo decidiste
 *     el 2026-09-11, porque con la tienda cerrada nadie tiene para qué crear
 *     una cuenta.
 *   · `/api` — los enlaces de los emails (`/api/auth/*`) y el chequeo de salud
 *     de Coolify (`/api/salud`): un 503 ahí marca el contenedor enfermo.
 *   · `/emails` — GoTrue baja las plantillas de acá. Si recibe un 503, los
 *     emails vuelven a salir con la plantilla de Supabase, en inglés, sin que
 *     nadie se entere.
 *   · `/marca` — el logo de los emails lo baja el proxy de imágenes de Gmail.
 *   · `/mantenimiento` — la página misma, para poder mirarla.
 *
 * Las imágenes, `_next/static` y el favicon ni llegan hasta acá: los saca el
 * `matcher` de `proxy.ts`.
 */
const SIEMPRE_PASAN = [
  "/admin",
  "/ingresar",
  "/recuperar",
  "/completar-perfil",
  "/error",
  "/api",
  "/emails",
  "/marca",
  "/mantenimiento",
] as const;

/**
 * Prefijo de SEGMENTO, no de texto: `/administrar` no es `/admin`, y
 * `/apiarios` no es `/api`. Un `startsWith` a secas abriría cualquier ruta
 * futura que empiece con las mismas letras.
 */
export function pasaSiempre(pathname: string): boolean {
  return SIEMPRE_PASAN.some(
    (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`),
  );
}

/**
 * Lo que dice el `Retry-After` del 503: una hora. No es una promesa —nadie
 * sabe cuánto va a tardar la carga—, es cuándo le conviene a un buscador
 * volver a mirar. Con el 503 Google entiende «cerrado por un rato» y no
 * desindexa; con un 200 tomaría esta página como el contenido de todo el
 * sitio.
 */
export const REINTENTAR_EN_SEGUNDOS = 3600;

/**
 * Cuánto se recuerda el interruptor entre pedidos. Es lo que tarda en notarse
 * prenderlo o apagarlo en el proxy, y lo que se ahorra: sin memoria, cada
 * página, cada imagen optimizada y cada pedido de datos de la navegación
 * pagarían una consulta.
 */
const VIGENCIA_MS = 5_000;

/**
 * La memoria, en el GLOBAL del proceso y no en una variable del módulo, por lo
 * mismo que la conexión (`db/index.ts`): el proxy y las páginas son dos
 * compilaciones con dos copias de este archivo. Así, cuando la acción que
 * cambia el interruptor lo olvida, lo olvidan las dos.
 */
declare global {
  var __anavendeMantenimiento: { activo: boolean; vence: number } | undefined;
}

export async function estaEnMantenimiento(): Promise<boolean> {
  const ahora = Date.now();
  const recordado = globalThis.__anavendeMantenimiento;
  if (recordado && recordado.vence > ahora) return recordado.activo;

  try {
    const [fila] = await db.execute<{ activo: boolean }>(sql`
      SELECT maintenance_mode AS activo FROM site_settings WHERE id = 1
    `);
    // Sin fila, abierta: la configuración todavía no se guardó nunca, y un
    // interruptor que no existe no puede estar prendido.
    const activo = fila?.activo ?? false;
    globalThis.__anavendeMantenimiento = { activo, vence: ahora + VIGENCIA_MS };
    return activo;
  } catch (error) {
    // Si la base no contesta, se sigue con LO ÚLTIMO QUE SE SUPO, y sin nada
    // sabido, abierta. Cerrar la tienda por un corte de la LAN convertiría un
    // hipo de la red en «estamos en mantenimiento» para todo el mundo; y si
    // estaba cerrada, lo sigue estando.
    console.error("[mantenimiento] No se pudo leer el interruptor.", error);
    return recordado?.activo ?? false;
  }
}

/**
 * Para la acción que lo cambia: sin esto, quien lo acaba de prender vería la
 * tienda abierta hasta cinco segundos más.
 */
export function olvidarElInterruptor(): void {
  globalThis.__anavendeMantenimiento = undefined;
}

/**
 * ¿Esta persona ve la tienda aunque esté cerrada? Una administradora, y que no
 * esté bloqueada (RF-27).
 *
 * Se lee de la base y no del token, por lo mismo que `lib/session.ts`: el rol
 * no viaja en el JWT, y uno escrito ahí quedaría congelado hasta que se
 * renueve. Si la consulta falla, NO: ver la tienda cerrada es un permiso, y
 * ante la duda un permiso no se da.
 */
export async function puedeVerLaTiendaCerrada(userId: string): Promise<boolean> {
  try {
    const [perfil] = await db
      .select({ role: userProfiles.role, isBanned: userProfiles.isBanned })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1);
    return perfil?.role === "admin" && !perfil.isBanned;
  } catch (error) {
    console.error("[mantenimiento] No se pudo leer el rol.", error);
    return false;
  }
}
