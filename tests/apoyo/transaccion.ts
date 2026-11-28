import { expect } from "vitest";

import { db } from "@/db";
import { motivoDel } from "@/tests/apoyo/errores";

/**
 * Para consultas y restricciones. Los tests de concurrencia usan
 * `apoyo/catalogo.ts`, que limpia por borrado (ver ahí por qué).
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

class Revertir extends Error {
  constructor() {
    super("revertir");
  }
}

export async function enTransaccionRevertida(
  fn: (tx: Tx) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      // Tirar es la única forma de que no commitee; el `catch` deja pasar
      // cualquier otro error para no convertir un test roto en verde.
      throw new Revertir();
    });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }
}

/**
 * Va en un SAVEPOINT (`tx.transaction()`) y el error se atrapa afuera: atrapado
 * adentro, el driver libera el savepoint sobre una transacción ya abortada y
 * todo lo siguiente falla con `current transaction is aborted`.
 */
export async function rechaza(
  tx: Tx,
  fn: (sp: Tx) => Promise<unknown>,
  /** Pasarlo casi siempre: sin él, una consulta mal escrita también «rechaza». */
  motivo?: RegExp,
): Promise<void> {
  let error: unknown;

  try {
    await tx.transaction(async (sp) => {
      await fn(sp);
    });
  } catch (e) {
    error = e;
  }

  expect(error, "la operación se aceptó, y no debía").toBeDefined();

  if (motivo) expect(motivoDel(error)).toMatch(motivo);
}
