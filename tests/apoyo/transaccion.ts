import { expect } from "vitest";

import { db } from "@/db";
import { motivoDel } from "@/tests/apoyo/errores";

/**
 * Correr un test dentro de una transacción que SIEMPRE se revierte.
 *
 * Es el patrón que traían `db:catalogo` y `db:restricciones`, y el que
 * `PROGRESO.md` marcó como el bueno frente al `finally` por convención de los
 * otros nueve: una limpieza que hay que acordarse de escribir es una limpieza
 * que un día no corre. Con esto no hay nada que acordarse — si el test explota
 * a la mitad, la transacción se revierte igual.
 *
 * **No reemplaza a `apoyo/catalogo.ts`**, que limpia por borrado. Esa decisión
 * está tomada y explicada allá: la Compuerta F4 necesita DOS transacciones de
 * verdad solapándose sobre la misma fila, y eso no se puede armar adentro de
 * una sola que después se deshace. Los dos patrones conviven a propósito, cada
 * uno donde corresponde: acá se prueban consultas y restricciones, allá se
 * prueban transacciones.
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Marca de que la reversión es la nuestra y no un fallo real del test. */
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
      // Un error es la única forma de que la transacción no commitee. El
      // `catch` de abajo distingue el nuestro de uno de verdad: tragarse
      // cualquier error acá convertiría un test roto en un test verde.
      throw new Revertir();
    });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }
}

/**
 * Comprueba que una operación sea RECHAZADA por la base.
 *
 * Va dentro de un SAVEPOINT —`tx.transaction()` emite uno— y el error se
 * atrapa AFUERA. Esa distinción no es estilo y ya mordió una vez: atrapado
 * adentro, el driver da por buena la operación y libera el punto de retorno
 * sobre una transacción que ya está abortada, y todo lo que venga después
 * falla con `current transaction is aborted` en vez de con lo que pasó.
 */
export async function rechaza(
  tx: Tx,
  fn: (sp: Tx) => Promise<unknown>,
  /**
   * Qué tiene que decir el error. **Vale la pena pasarlo casi siempre**: sin
   * él basta con que algo falle, y «algo» incluye que la consulta esté mal
   * escrita o que el savepoint no se haya creado. Un rechazo por el motivo
   * equivocado se lee igual que el rechazo que se quería probar.
   */
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
