/**
 * Las mismas categorías todo el día y otras al siguiente, sin guardar nada
 * (TECHNICAL-SPEC §10.5). Se ordena por `id` antes de mezclar para no depender
 * del orden en que llegan las filas.
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
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 2 ** 32;
  };
  // Semillas vecinas (un día y el siguiente) empiezan parecidas: así se
  // separan.
  for (let i = 0; i < 8; i++) azar();
  for (let i = ordenada.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [ordenada[i], ordenada[j]] = [ordenada[j], ordenada[i]];
  }
  return ordenada.slice(0, Math.max(0, cuantas));
}
