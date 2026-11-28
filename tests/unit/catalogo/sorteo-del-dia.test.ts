import { describe, expect, test } from "vitest";

import { argentinaDayNumber } from "@/lib/scenes";
import { dailyPick } from "@/lib/daily-pick";

/**
 * Las seis categorías del hero (TS §10.5): las mismas todo el día, otras al
 * siguiente, y con el día de Argentina.
 */

const categorias = Array.from({ length: 31 }, (_, i) => ({
  id: `c${String(i).padStart(2, "0")}`,
}));
const ids = (l: { id: string }[]) => l.map((c) => c.id);

describe("dailyPick", () => {
  test("mismo día, mismas categorías, aunque lleguen en otro orden", () => {
    const hoy = dailyPick(categorias, 6, 20261120);
    const otraVez = dailyPick([...categorias].reverse(), 6, 20261120);
    expect(ids(otraVez)).toEqual(ids(hoy));
  });

  test("seis distintas, y otro grupo al día siguiente", () => {
    const hoy = dailyPick(categorias, 6, 20261120);
    const manana = dailyPick(categorias, 6, 20261121);
    expect(new Set(ids(hoy)).size).toBe(6);
    expect(ids(manana)).not.toEqual(ids(hoy));
  });

  test("en unos días pasan casi todas", () => {
    const vistas = new Set<string>();
    for (let d = 1; d <= 10; d++)
      for (const c of dailyPick(categorias, 6, 20261100 + d)) vistas.add(c.id);
    expect(vistas.size).toBeGreaterThanOrEqual(25);
  });

  test("con menos de seis van las que haya, y no toca la lista original", () => {
    const pocas = categorias.slice(0, 3);
    const copia = [...pocas];
    expect(dailyPick(pocas, 6, 20261120)).toHaveLength(3);
    expect(pocas).toEqual(copia);
    expect(dailyPick([], 6, 20261120)).toEqual([]);
  });
});

describe("argentinaDayNumber", () => {
  test("cambia a la medianoche de Argentina, no a la de UTC", () => {
    // 02:59 UTC del 21 = 23:59 del 20 en Argentina.
    expect(argentinaDayNumber(new Date("2026-11-21T02:59:00Z"))).toBe(20261120);
    expect(argentinaDayNumber(new Date("2026-11-21T03:00:00Z"))).toBe(20261121);
  });
});
