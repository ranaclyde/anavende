import "server-only";

import { headers } from "next/headers";

import { domainError } from "@/lib/errors";

/**
 * Un tope de pedidos por ventana de tiempo — TECHNICAL-SPEC §16, F10.5.
 *
 * Lo usa la subida de imágenes, que es lo único que §16 pide limitar además
 * de Auth (y Auth lo limita GoTrue). Cada subida pone a sharp a generar
 * cuatro tamaños, y sharp es lo que más memoria come en el servidor (§9, R3):
 * un cliente que entre en un bucle, o una sesión de administradora robada,
 * puede tumbar el contenedor a fuerza de fotos sin pasar por ningún otro
 * control, porque todas son legítimas una por una.
 *
 * **En memoria, a propósito.** La aplicación corre en un solo contenedor
 * (§18), así que un `Map` ve todos los pedidos; Redis sería un servicio más
 * para mantener sin nada que lo justifique. Si un día hay dos réplicas, cada
 * una cuenta por su lado y el tope real pasa a ser el doble: sigue frenando
 * el bucle, que es para lo que está.
 *
 * Ventana deslizante: se guardan los instantes de los pedidos de cada clave y
 * se descartan los que ya salieron de la ventana. Con una ventana fija, el
 * tope entero cabría dos veces seguidas alrededor del cambio de minuto.
 */

const pedidos = new Map<string, number[]>();

export type Resultado =
  { permitido: true } | { permitido: false; reintentarEnSegundos: number };

export function consumir(
  clave: string,
  { tope, ventanaMs }: { tope: number; ventanaMs: number },
  ahora: number = Date.now(),
): Resultado {
  const desde = ahora - ventanaMs;
  const recientes = (pedidos.get(clave) ?? []).filter((t) => t > desde);

  if (recientes.length >= tope) {
    pedidos.set(clave, recientes);
    // Se libera un lugar cuando sale de la ventana el más viejo.
    const libre = recientes[0] + ventanaMs - ahora;
    return {
      permitido: false,
      reintentarEnSegundos: Math.max(1, Math.ceil(libre / 1000)),
    };
  }

  recientes.push(ahora);
  pedidos.set(clave, recientes);
  return { permitido: true };
}

/** Solo para los tests: cada uno arranca sin pedidos anteriores. */
export function reiniciarLimites(): void {
  pedidos.clear();
}

/**
 * Quién pide, para el tope por persona del ingreso, el alta y los reenvíos
 * (F10.5). Es la IP que pone Cloudflare; sin ella, la primera de
 * `X-Forwarded-For`, que es lo que deja Traefik.
 *
 * **Hoy alcanza para quien entra por el dominio, no para quien no.** El
 * servidor APP también contesta por HTTPS directo a su IP, sin pasar por
 * Cloudflare (comprobado desde afuera el 2026-10-17), y ahí cualquiera puede
 * mandar la cabecera con el valor que quiera. Se cierra en el servidor,
 * dejando entrar al 443 solo desde Cloudflare: está en PROGRESO.md, F10.5.
 *
 * `null` fuera de un pedido —los tests que llaman a una acción directo—: no
 * hay a quién limitar. Y `null` fuera de producción: la suite E2E entra
 * decenas de veces seguidas desde la misma máquina, y con el tope prendido
 * en `next dev` se cortaría sola. Lo prueba `tests/unit/seguridad/limite.test.ts`
 * con el entorno de producción simulado.
 */
async function quienPide(): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") return null;

  let h: Headers;
  try {
    h = await headers();
  } catch {
    return null;
  }
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconocida"
  );
}

function espera(segundos: number): string {
  if (segundos < 60) return `${segundos} segundos`;
  const minutos = Math.ceil(segundos / 60);
  return minutos === 1 ? "un minuto" : `${minutos} minutos`;
}

/**
 * Corta con `TOO_MANY_ATTEMPTS` si quien pide ya usó su cupo para `accion`.
 * El mensaje no dice nada del email: el tope es por persona, no por cuenta,
 * así que no sirve para saber si una existe (RF-06).
 */
export async function frenarSiInsiste(
  accion: string,
  cupo: { tope: number; ventanaMs: number },
): Promise<void> {
  const quien = await quienPide();
  if (quien === null) return;

  const r = consumir(`${accion}:${quien}`, cupo);
  if (!r.permitido) {
    throw domainError("TOO_MANY_ATTEMPTS", {
      message: `Probaste muchas veces seguidas. Esperá ${espera(r.reintentarEnSegundos)} y probá de nuevo.`,
      details: { reintentarEnSegundos: r.reintentarEnSegundos },
    });
  }
}
