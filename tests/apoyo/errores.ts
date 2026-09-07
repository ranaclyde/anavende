import { expect } from "vitest";

/**
 * Leer el motivo de un error, y exigirlo.
 *
 * **Por qué existe:** Drizzle envuelve el error del driver en un
 * `DrizzleQueryError` cuyo mensaje es solo «Failed query: SELECT …». El motivo
 * de verdad —la restricción violada, el código de Postgres— viaja en `cause`.
 * Un `toThrow(/constraint/)` directo contra ese envoltorio no matchea NUNCA, y
 * la salida cómoda ante eso es sacar el motivo y quedarse con un rechazo que
 * se conforma con que algo falle: pasa igual si la consulta está mal escrita.
 */
export function motivoDel(error: unknown): string {
  return [
    (error as Error)?.message,
    ((error as { cause?: Error })?.cause)?.message,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Una llamada que TIENE que fallar, y por el motivo que se dice.
 *
 * Para lo que no pasa por una transacción de test: funciones de la aplicación
 * y SQL suelto. La versión con SAVEPOINT vive en `apoyo/transaccion.ts`, y la
 * diferencia no es estilo: adentro de una transacción, una sentencia que falla
 * la aborta entera, y sin punto de retorno todo lo que venga después falla con
 * `current transaction is aborted` en vez de con lo que pasó.
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
