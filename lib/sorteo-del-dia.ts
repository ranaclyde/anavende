/**
 * El sorteo de las categorías del hero (F10.7d, TS §10.5): las mismas todo el
 * día y otras al día siguiente, sin guardar nada.
 *
 * Se ordena por `id` antes de mezclar, para que el resultado no dependa del
 * orden en que llegan las filas, y se mezcla con un generador con semilla
 * (Fisher–Yates sobre un LCG): mismo día, mismas categorías, en cualquier
 * servidor y en cada pedido.
 */
export function sorteoDelDia<T extends { id: string }>(
  lista: readonly T[],
  cuantas: number,
  semilla: number,
): T[] {
  const ordenada = [...lista].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  let estado = semilla >>> 0 || 1;
  const azar = () => {
    // Numerical Recipes: alcanza para mezclar unas decenas de filas.
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 2 ** 32;
  };
  // Unas vueltas en falso: semillas vecinas (un día y el siguiente) empiezan
  // parecidas, y así se separan.
  for (let i = 0; i < 8; i++) azar();
  for (let i = ordenada.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [ordenada[i], ordenada[j]] = [ordenada[j], ordenada[i]];
  }
  return ordenada.slice(0, Math.max(0, cuantas));
}
