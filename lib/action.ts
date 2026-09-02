import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import {
  DomainError,
  isDomainError,
  type DomainErrorCode,
} from "@/lib/errors";
import { getSession, type Session } from "@/lib/session";

/**
 * Envoltorio de Server Actions — TECHNICAL-SPEC §6.2.
 *
 * TODAS las mutaciones pasan por acá, de modo que autenticación, rol,
 * validación y traducción de errores no dependan de que alguien se acuerde de
 * escribirlas. Una guardia que hay que recordar es una guardia que un día se
 * olvida, y ese día es el que importa.
 *
 * Garantiza, en este orden:
 *   1. Identidad y perfil FRESCOS de la base (§13.3). Sin perfil, se rechaza.
 *   2. Usuario bloqueado: rechazado en toda acción (RF-27).
 *   3. Validación con Zod EN EL SERVIDOR, aunque el formulario ya haya
 *      validado en el cliente.
 *   4. Ejecución en try/catch que distingue errores de dominio de inesperados.
 *   5. Respuesta uniforme. Nunca se propaga un mensaje de Postgres ni un
 *      stack trace al cliente.
 *   6. Sentry solo para lo inesperado: un «sin stock» no es un incidente.
 */

export type ActionOk<T> = { ok: true; data: T };

export type ActionErr = {
  ok: false;
  code: DomainErrorCode;
  message: string;
  /** Errores por campo, cuando el código es VALIDATION. */
  details?: Record<string, unknown>;
};

export type ActionResult<T> = ActionOk<T> | ActionErr;

/** `public` no exige sesión; `customer` y `admin` sí. */
export type AuthLevel = "public" | "customer" | "admin";

type Ctx<L extends AuthLevel> = L extends "public"
  ? { session: Session | null }
  : { session: Session };

function fallo(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ActionErr {
  return { ok: false, code, message, details };
}

class ActionBuilder<TInput, L extends AuthLevel> {
  constructor(
    private readonly schema: z.ZodType<TInput> | null,
    private readonly level: L,
  ) {}

  input<T>(schema: z.ZodType<T>): ActionBuilder<T, L> {
    return new ActionBuilder<T, L>(schema, this.level);
  }

  auth<N extends AuthLevel>(level: N): ActionBuilder<TInput, N> {
    return new ActionBuilder<TInput, N>(
      this.schema as z.ZodType<TInput> | null,
      level,
    );
  }

  handler<TOutput>(
    fn: (args: { input: TInput; ctx: Ctx<L> }) => Promise<TOutput>,
  ): (input: TInput) => Promise<ActionResult<TOutput>> {
    const { schema, level } = this;

    return async (raw: TInput): Promise<ActionResult<TOutput>> => {
      // ── 1 y 2. Identidad, perfil y bloqueo ───────────────────────────
      let session: Session | null = null;

      if (level !== "public") {
        session = await getSession();

        // Sin sesión o sin perfil: para el envoltorio son lo mismo, falta de
        // autorización (§13.4).
        if (!session) {
          return fallo(
            "FORBIDDEN",
            "Necesitás iniciar sesión para hacer eso.",
          );
        }

        if (session.profile.isBanned) {
          return fallo("USER_BANNED", "Tu cuenta está bloqueada.", {
            reason: session.profile.banReason,
          });
        }

        if (level === "admin" && session.role !== "admin") {
          return fallo("FORBIDDEN", "No tenés permiso para hacer eso.");
        }
      } else {
        // Una acción pública igual quiere saber quién es, si hay alguien.
        session = await getSession();
      }

      // ── 3. Validación en el servidor ─────────────────────────────────
      let input = raw;
      if (schema) {
        const resultado = await schema.safeParseAsync(raw);
        if (!resultado.success) {
          return fallo(
            "VALIDATION",
            "Revisá los datos: hay algo que no está bien.",
            // treeifyError da la forma anidada que el formulario necesita
            // para colgar cada mensaje de su campo.
            { fields: z.treeifyError(resultado.error) },
          );
        }
        input = resultado.data;
      }

      // ── 4, 5 y 6. Ejecución y traducción de errores ──────────────────
      try {
        const data = await fn({
          input,
          ctx: { session } as Ctx<L>,
        });
        return { ok: true, data };
      } catch (e) {
        if (isDomainError(e)) {
          // Resultado del negocio, no incidente: no va a Sentry.
          return fallo(e.code, e.message, e.details);
        }

        // Inesperado. Se reporta con contexto, pero el cliente recibe una
        // frase, jamás el mensaje de Postgres ni un stack trace.
        //
        // En desarrollo además se imprime: sin esto el error queda invisible
        // —Sentry no está configurado en local— y depurar una acción se
        // vuelve adivinar.
        if (process.env.NODE_ENV !== "production") {
          console.error("[server action] error inesperado:", e);
        }

        Sentry.captureException(e, {
          tags: { capa: "server-action", auth: level },
          user: session ? { id: session.identity.userId } : undefined,
        });

        return fallo(
          "INTERNAL",
          "No pudimos completar la acción. Probá de nuevo en un momento.",
        );
      }
    };
  }
}

/**
 * Punto de entrada. Uso:
 *
 *   export const addToCart = action
 *     .input(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(99) }))
 *     .auth("customer")
 *     .handler(async ({ input, ctx }) => { … });
 */
export const action = new ActionBuilder<unknown, "public">(null, "public");

export { DomainError };
