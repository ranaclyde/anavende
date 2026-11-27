import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";

// Lo llama `lib/supabase/proxy.ts` en cada pedido: se mira primero la ruta,
// después el interruptor (recordado unos segundos) y recién al final el rol.
//
// Sin `server-only`, como `db/index.ts`: lo importa `proxy.ts`, que no es un
// Server Component.

/**
 * Lo que pasa siempre, con la tienda abierta o cerrada:
 *
 *   · `/ingresar`, `/recuperar`, `/completar-perfil`, `/error` — sin ellos, una
 *     administradora deslogueada no podría volver a entrar. `/registro` no.
 *   · `/api` — enlaces de los emails y `/api/salud`: un 503 ahí y Coolify marca
 *     el contenedor enfermo.
 *   · `/emails` — si GoTrue recibe un 503 al bajar las plantillas, manda las de
 *     Supabase, en inglés, sin avisar.
 *   · `/marca` — el logo de los emails lo baja el proxy de imágenes de Gmail.
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

/** Prefijo de segmento, no de texto: `/apiarios` no es `/api`. */
export function pasaSiempre(pathname: string): boolean {
  return SIEMPRE_PASAN.some(
    (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`),
  );
}

/** Con un 503 Google no desindexa; con un 200 la tomaría por todo el sitio. */
export const REINTENTAR_EN_SEGUNDOS = 3600;

const VIGENCIA_MS = 5_000;

/**
 * En el global y no en el módulo, como la conexión (`db/index.ts`): el proxy y
 * las páginas son dos compilaciones con dos copias de este archivo.
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
    const activo = fila?.activo ?? false;
    globalThis.__anavendeMantenimiento = { activo, vence: ahora + VIGENCIA_MS };
    return activo;
  } catch (error) {
    // Sin base, lo último que se supo, y si no, abierta: un corte de la red no
    // puede cerrar la tienda.
    console.error("[mantenimiento] No se pudo leer el interruptor.", error);
    return recordado?.activo ?? false;
  }
}

/** Si no se olvida, quien lo prende vería la tienda abierta unos segundos. */
export function olvidarElInterruptor(): void {
  globalThis.__anavendeMantenimiento = undefined;
}

/**
 * Admin y no bloqueada (RF-27). De la base y no del token: el rol no viaja en
 * el JWT. Si la consulta falla, no: ante la duda un permiso no se da.
 */
export async function puedeVerLaTiendaCerrada(
  userId: string,
): Promise<boolean> {
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

/** Con la tienda cerrada solo entran administradoras (los dos ingresos). */
export async function laTiendaEstaCerradaPara(
  userId: string,
): Promise<boolean> {
  if (!(await estaEnMantenimiento())) return false;
  return !(await puedeVerLaTiendaCerrada(userId));
}
