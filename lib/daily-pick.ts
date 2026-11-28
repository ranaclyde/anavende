/**
 * Las mismas categorías todo el día y otras al siguiente, sin guardar nada
 * (TECHNICAL-SPEC §10.5). Se ordena por `id` antes de mezclar para no depender
 * del orden en que llegan las filas.
 */
export function dailyPick<T extends { id: string }>(
  list: readonly T[],
  count: number,
  seed: number,
): T[] {
  const sorted = [...list].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  let state = seed >>> 0 || 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  // Semillas vecinas (un día y el siguiente) empiezan parecidas: así se
  // separan.
  for (let i = 0; i < 8; i++) random();
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  return sorted.slice(0, Math.max(0, count));
}
