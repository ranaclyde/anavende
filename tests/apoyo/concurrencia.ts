import { db } from "@/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Dos transacciones solapadas de verdad sobre la misma fila. Un `Promise.all`
 * no alcanza: la primera puede commitear entera antes de que abra la segunda.
 * Acá la primera escribe y queda abierta; la segunda se bloquea en el `UPDATE`
 * y, al commitear la primera, reevalúa su `WHERE` contra la fila ya cambiada.
 * Los 150 ms son el margen para que la segunda llegue a bloquearse.
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

/**
 * Lo mismo para funciones que abren su propia transacción (como
 * `crearOrdenDesdeCarrito()`): una tercera transacción retiene el bloqueo de
 * la fila hasta que las dos quedan esperándola, y recién ahí lo suelta.
 */
export async function dosCompitiendo<A, B>(
  tomarElBloqueo: (tx: Transaccion) => Promise<void>,
  a: () => Promise<A>,
  b: () => Promise<B>,
): Promise<[PromiseSettledResult<A>, PromiseSettledResult<B>]> {
  let bloqueoTomado!: () => void;
  const yaBloqueada = new Promise<void>((r) => {
    bloqueoTomado = r;
  });

  let soltar!: () => void;
  const puedeSoltar = new Promise<void>((r) => {
    soltar = r;
  });

  const guardiana = db.transaction(async (tx) => {
    await tomarElBloqueo(tx);
    bloqueoTomado();
    await puedeSoltar;
  });

  await Promise.race([yaBloqueada, guardiana.catch(() => undefined)]);

  const trabajoA = a();
  const trabajoB = b();

  // El margen para que las dos lleguen a la fila y se queden esperándola.
  await new Promise((r) => setTimeout(r, 200));
  soltar();
  await guardiana;

  return Promise.allSettled([trabajoA, trabajoB]) as Promise<
    [PromiseSettledResult<A>, PromiseSettledResult<B>]
  >;
}
