import { db } from "@/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Dos transacciones solapadas de verdad, sobre la misma fila.
 *
 * **Por qué hace falta esto y no alcanza un `Promise.all`.** Lanzar las dos a
 * la vez no garantiza que se solapen: el planificador puede correr la primera
 * entera —incluido el COMMIT— antes de que la segunda abra su conexión. El
 * resultado del test sería idéntico, verde, y no habría probado nada. Un test
 * de condición de carrera que no fuerza la carrera es un test que dice que sí
 * a un sistema roto.
 *
 * **Cómo lo fuerza.** La primera transacción hace su trabajo y **se queda
 * abierta**. Recién ahí arranca la segunda, que al llegar al `UPDATE` de la
 * misma fila se queda esperando el bloqueo. Con las dos en ese estado, la
 * primera commitea; la segunda se despierta, vuelve a evaluar su `WHERE`
 * contra la fila YA cambiada y decide sobre lo que hay ahora, no sobre lo que
 * había cuando arrancó.
 *
 * Ese despertar es exactamente el momento que decide si el sistema vende dos
 * veces la última unidad. Es lo único que este andamiaje existe para poner
 * bajo prueba.
 *
 * La espera de 150 ms es el margen para que la segunda llegue a bloquearse. Si
 * no llegara, la primera commitearía antes y el test volvería a ser el que no
 * prueba nada — pero no daría un falso verde: daría el mismo resultado por el
 * camino secuencial, y ese caso ya está cubierto por los tests de «hacerlo dos
 * veces seguidas».
 */
export async function dosALaVez<A, B>(
  primera: (tx: Transaccion) => Promise<A>,
  segunda: (tx: Transaccion) => Promise<B>,
): Promise<[PromiseSettledResult<A>, PromiseSettledResult<B>]> {
  let avisarQueYaEscribio!: () => void;
  const yaEscribio = new Promise<void>((r) => {
    avisarQueYaEscribio = r;
  });

  let dejarCommitear!: () => void;
  const puedeCommitear = new Promise<void>((r) => {
    dejarCommitear = r;
  });

  const trabajoA = db.transaction(async (tx) => {
    const resultado = await primera(tx);
    avisarQueYaEscribio();
    // La transacción sigue abierta acá: los bloqueos que tomó no se sueltan.
    await puedeCommitear;
    return resultado;
  });

  // Si la primera falla antes de avisar, no hay que esperarla para siempre.
  await Promise.race([yaEscribio, trabajoA.catch(() => undefined)]);

  const trabajoB = db.transaction(segunda);

  await new Promise((r) => setTimeout(r, 150));
  dejarCommitear();

  return Promise.allSettled([trabajoA, trabajoB]) as Promise<
    [PromiseSettledResult<A>, PromiseSettledResult<B>]
  >;
}
