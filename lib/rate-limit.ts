import "server-only";

import { headers } from "next/headers";

import { domainError } from "@/lib/errors";

// Ventana deslizante en memoria (TECHNICAL-SPEC §16): la aplicación corre en
// un solo contenedor. Con dos réplicas, cada una contaría por su lado.

const requests = new Map<string, number[]>();

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function consume(
  key: string,
  { tope, ventanaMs }: { tope: number; ventanaMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const since = now - ventanaMs;
  const recent = (requests.get(key) ?? []).filter((t) => t > since);

  if (recent.length >= tope) {
    requests.set(key, recent);
    const waitMs = recent[0] + ventanaMs - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
    };
  }

  recent.push(now);
  requests.set(key, recent);
  return { allowed: true };
}

/** Solo para los tests. */
export function resetRateLimits(): void {
  requests.clear();
}

/**
 * La IP de Cloudflare; sin ella, la primera de `X-Forwarded-For` (Traefik).
 * `null` fuera de un pedido y fuera de producción: la suite E2E entra decenas
 * de veces seguidas desde la misma máquina y se cortaría sola.
 */
async function requesterIp(): Promise<string | null> {
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

function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "un minuto" : `${minutes} minutos`;
}

/**
 * Corta con `TOO_MANY_ATTEMPTS` si quien pide ya usó su cupo para `actionName`.
 * Por persona y no por cuenta: no sirve para saber si una existe (RF-06).
 */
export async function rateLimitOrThrow(
  actionName: string,
  quota: { tope: number; ventanaMs: number },
): Promise<void> {
  const requester = await requesterIp();
  if (requester === null) return;

  const r = consume(`${actionName}:${requester}`, quota);
  if (!r.allowed) {
    throw domainError("TOO_MANY_ATTEMPTS", {
      message: `Probaste muchas veces seguidas. Esperá ${waitText(r.retryAfterSeconds)} y probá de nuevo.`,
      details: { retryAfterSeconds: r.retryAfterSeconds },
    });
  }
}
