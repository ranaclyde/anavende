import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import {
  DomainError,
  domainMessage,
  isDomainError,
  type DomainErrorCode,
} from "@/lib/errors";
import { getIdentity, getSession, type Session } from "@/lib/session";

// El envoltorio de Server Actions (TECHNICAL-SPEC §6.2): todas las mutaciones
// pasan por acá, para que sesión, rol, validación y errores no dependan de
// que alguien se acuerde.

export type ActionOk<T> = { ok: true; data: T };

export type ActionErr = {
  ok: false;
  code: DomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ActionResult<T> = ActionOk<T> | ActionErr;

export type AuthLevel = "public" | "customer" | "admin";

type Ctx<L extends AuthLevel> = L extends "public"
  ? { session: Session | null }
  : { session: Session };

function failure(
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
    private readonly allowsPendingClosure = false,
  ) {}

  input<T>(schema: z.ZodType<T>): ActionBuilder<T, L> {
    return new ActionBuilder<T, L>(
      schema,
      this.level,
      this.allowsPendingClosure,
    );
  }

  auth<N extends AuthLevel>(level: N): ActionBuilder<TInput, N> {
    return new ActionBuilder<TInput, N>(
      this.schema as z.ZodType<TInput> | null,
      level,
      this.allowsPendingClosure,
    );
  }

  /**
   * Con la baja pedida, la cuenta es de solo lectura (RF-34) salvo lo que
   * declara esto.
   */
  evenWithPendingClosure(): ActionBuilder<TInput, L> {
    return new ActionBuilder<TInput, L>(this.schema, this.level, true);
  }

  handler<TOutput>(
    fn: (args: { input: TInput; ctx: Ctx<L> }) => Promise<TOutput>,
  ): (input: TInput) => Promise<ActionResult<TOutput>> {
    const { schema, level, allowsPendingClosure } = this;

    return async (raw: TInput): Promise<ActionResult<TOutput>> => {
      let session: Session | null = null;

      if (level !== "public") {
        session = await getSession();

        // `getIdentity` está en `cache()` y `getSession` ya la pidió: no es
        // otra verificación.
        if (!session) {
          return failure(
            "FORBIDDEN",
            (await getIdentity())
              ? "Te falta completar tu perfil. Completalo y probá de nuevo."
              : "Necesitás iniciar sesión para hacer eso.",
          );
        }

        if (session.profile.isBanned) {
          return failure("USER_BANNED", "Tu cuenta está bloqueada.", {
            reason: session.profile.banReason,
          });
        }

        // Antes de mirar el nivel: una cuenta dada de baja no puede ni retirar
        // el pedido. `!= null` a propósito: una fila leída sin esa columna vale
        // `undefined`, y con `!==` toda la tienda quedaría dada de baja.
        if (session.profile.closedAt != null) {
          return failure("ACCOUNT_CLOSED", domainMessage("ACCOUNT_CLOSED"));
        }

        if (level === "admin" && session.role !== "admin") {
          return failure("FORBIDDEN", "No tenés permiso para hacer eso.");
        }

        if (
          level === "customer" &&
          session.profile.closureRequestedAt !== null &&
          !allowsPendingClosure
        ) {
          return failure(
            "ACCOUNT_CLOSURE_PENDING",
            domainMessage("ACCOUNT_CLOSURE_PENDING"),
          );
        }
      } else {
        session = await getSession();
      }

      let input = raw;
      if (schema) {
        const result = await schema.safeParseAsync(raw);
        if (!result.success) {
          return failure(
            "VALIDATION",
            "Revisá los datos: hay algo que no está bien.",
            { fields: z.treeifyError(result.error) },
          );
        }
        input = result.data;
      }

      try {
        const data = await fn({
          input,
          ctx: { session } as Ctx<L>,
        });
        return { ok: true, data };
      } catch (e) {
        if (isDomainError(e)) {
          return failure(e.code, e.message, e.details);
        }

        // Al cliente, nunca el mensaje de Postgres ni el stack trace. En local
        // se imprime porque Sentry no está configurado.
        if (process.env.NODE_ENV !== "production") {
          console.error("[server action] error inesperado:", e);
        }

        Sentry.captureException(e, {
          tags: { capa: "server-action", auth: level },
          user: session ? { id: session.identity.userId } : undefined,
        });

        return failure(
          "INTERNAL",
          "No pudimos completar la acción. Probá de nuevo en un momento.",
        );
      }
    };
  }
}

/**
 * Uso:
 *
 *   export const addToCart = action
 *     .input(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(99) }))
 *     .auth("customer")
 *     .handler(async ({ input, ctx }) => { … });
 */
export const action = new ActionBuilder<unknown, "public">(null, "public");

export { DomainError };
