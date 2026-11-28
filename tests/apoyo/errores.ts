import { expect } from "vitest";

/**
 * Drizzle envuelve el error del driver en un `DrizzleQueryError` que solo dice
 * «Failed query: …»; el motivo de Postgres viaja en `cause`, así que un
 * `toThrow(/constraint/)` directo no matchea nunca.
 */
export function motivoDel(error: unknown): string {
  return [
    (error as Error)?.message,
    (error as { cause?: Error })?.cause?.message,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Para lo que no corre dentro de una transacción de test. Adentro de una, usar
 * `rechaza` de `apoyo/transaccion.ts`: sin SAVEPOINT, el fallo la aborta y lo
 * que sigue da `current transaction is aborted`.
 */
export async function rechazaLlamada(
  fn: () => Promise<unknown>,
  motivo?: RegExp,
): Promise<void> {
  let error: unknown;

  try {
    await fn();
  } catch (e) {
    error = e;
  }

  expect(error, "la operación se aceptó, y no debía").toBeDefined();
  if (motivo) expect(motivoDel(error)).toMatch(motivo);
}
