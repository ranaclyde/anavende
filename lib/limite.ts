import "server-only";

import { headers } from "next/headers";

import { domainError } from "@/lib/errors";

// Ventana deslizante en memoria (TECHNICAL-SPEC §16): la aplicación corre en
// un solo contenedor. Con dos réplicas, cada una contaría por su lado.

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

/** Solo para los tests. */
export function reiniciarLimites(): void {
  pedidos.clear();
}

/**
 * La IP de Cloudflare; sin ella, la primera de `X-Forwarded-For` (Traefik).
 * `null` fuera de un pedido y fuera de producción: la suite E2E entra decenas
 * de veces seguidas desde la misma máquina y se cortaría sola.
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
 * Por persona y no por cuenta: no sirve para saber si una existe (RF-06).
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
