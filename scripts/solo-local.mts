/**
 * Qué cuenta como «el stack local», y por qué se decide acá y en un solo lado.
 *
 * **Qué era esto hasta F4.0b.** Vivía acá `soloLocal()`, la guarda que frenaba
 * a los nueve scripts de verificación que ESCRIBÍAN —creaban marcas, productos
 * y variantes, subían archivos al bucket— para que no corrieran contra la base
 * de Ana. Esos scripts se migraron a Vitest y ya no existen, así que la guarda
 * se fue con ellos: quien la reemplaza es `tests/setup/entorno.ts`, que aplica
 * la misma regla desde el otro lado y SIN escape, porque una batería de tests
 * que crea órdenes y las cancela no tiene ningún caso legítimo contra
 * producción.
 *
 * Lo que queda es la REGLA sola, sin efectos, con un consumidor. Sigue viviendo
 * en su propio archivo por el mismo motivo de siempre: el día que el puerto
 * cambie, tiene que cambiar en un solo lugar.
 *
 * **Cómo decide, y por qué así.** Mira que la URL sea exactamente la del stack
 * local declarado en `supabase/config.toml`: loopback y el puerto. No alcanza
 * con mirar el host, y este es el motivo: el acceso a producción va por un
 * **túnel SSH** (F0.4 exige que Postgres no responda desde afuera), y a través
 * de un túnel producción se ve como `127.0.0.1`. De ahí la regla que hay que
 * respetar del otro lado:
 *
 *     EL TÚNEL SSH NUNCA USA EL PUERTO 54322.
 *
 * Si algún día lo usara, esto dejaría pasar contra producción todo lo que
 * existe para frenar.
 */

/** El de `supabase/config.toml`, `[db] port`. Si cambia allá, cambia acá. */
const PUERTO_DEL_STACK_LOCAL = "54322";

/** El de `supabase/config.toml`, `[api] port`: Storage, Auth y el resto. */
const PUERTO_API_DEL_STACK_LOCAL = "54321";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * La regla, sola y sin efectos: ¿esta URL es la del stack local?
 *
 * Vive separada porque tiene DOS consumidores —los scripts de verificación y
 * la guarda de los tests de F4 (`tests/setup/entorno.ts`)— y el puerto y el
 * loopback no pueden estar escritos en dos lados: el día que cambie uno,
 * el otro se queda dejando pasar lo que existe para frenar.
 */
export function esStackLocal(crudo: string): boolean {
  return esLoopbackEnPuerto(crudo, PUERTO_DEL_STACK_LOCAL);
}

/**
 * Lo mismo para la API del stack local —Storage, Auth—, que es la que usan
 * los tests de F2.2, F2.4 y F2.6 al subir y borrar archivos de verdad.
 *
 * Hace falta aparte de `esStackLocal` porque son DOS puertas distintas: la
 * base va por el 54322 y Storage por el 54321, y apuntar bien una no dice
 * nada de la otra. Sin esta, `.env.test` podría llevar la clave `service_role`
 * de producción al lado de una `DATABASE_URL` local y los tests subirían
 * archivos de prueba al bucket de Ana con la guarda en verde.
 */
export function esApiDelStackLocal(crudo: string): boolean {
  return esLoopbackEnPuerto(crudo, PUERTO_API_DEL_STACK_LOCAL);
}

function esLoopbackEnPuerto(crudo: string, puerto: string): boolean {
  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    return false;
  }
  return LOOPBACK.has(url.hostname) && url.port === puerto;
}

/**
 * Para los mensajes de error: «127.0.0.1:5433».
 *
 * El puerto por omisión se pasa porque estas URL no son todas de Postgres: en
 * una `https://…` sin puerto, decir «:5432» inventa un dato y manda a mirar el
 * lugar equivocado justo cuando alguien está tratando de entender por qué su
 * configuración no arranca.
 */
export function dondeApunta(crudo: string, porOmision = "5432"): string {
  try {
    const url = new URL(crudo);
    return url.port ? `${url.hostname}:${url.port}` : porOmision
      ? `${url.hostname}:${porOmision}`
      : url.hostname;
  } catch {
    return crudo;
  }
}
