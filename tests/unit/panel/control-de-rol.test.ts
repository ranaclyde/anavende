import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

/**
 * El layout de `/admin` no alcanza: Next renderiza la página en paralelo y
 * sus datos viajan aunque el layout dé 404 (TS §13.3). Este test impide que
 * una página nueva se agregue sin el control; mira el texto del archivo, y el
 * ataque de verdad lo prueba `tests/e2e/panel-cerrado.spec.ts`.
 */

const RAIZ = join(process.cwd(), "app", "admin");

function paginas(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) return paginas(ruta);
    return e.name === "page.tsx" ? [ruta] : [];
  });
}

/** El cuerpo de una función exportada, desde su firma hasta el final del archivo. */
function desde(texto: string, firma: RegExp): string | null {
  const m = firma.exec(texto);
  return m ? texto.slice(m.index) : null;
}

/**
 * Antes de `await exigirAdmin()` solo puede estar la firma: lo que se leyera
 * antes ya habría corrido para quien no es administradora.
 */
function loPrimeroEsElControl(cuerpo: string): boolean {
  const apertura = cuerpo.search(/\) (?::[^{]*)?\{\n/);
  if (apertura === -1) return false;
  const resto = cuerpo.slice(cuerpo.indexOf("{\n", apertura) + 2);
  return /^\s*(?:const \w+ = )?await exigirAdmin\(\);/.test(resto);
}

const todas = paginas(RAIZ);

describe("el control de rol del panel", () => {
  test("encuentra las páginas", () => {
    expect(todas.length).toBeGreaterThanOrEqual(20);
  });

  test.each(todas.map((p) => [relative(process.cwd(), p), p]))(
    "%s lo llama antes que nada",
    (_, ruta) => {
      const texto = readFileSync(ruta, "utf8");

      const pagina = desde(texto, /^export default async function \w+\(/m);
      expect(pagina, "la página es una función async").not.toBeNull();
      expect(loPrimeroEsElControl(pagina!)).toBe(true);

      // Los metadatos corren en paralelo con la página: si leen la base,
      // también filtran.
      const metadatos = desde(
        texto,
        /^export async function generateMetadata\(/m,
      );
      if (metadatos) expect(loPrimeroEsElControl(metadatos)).toBe(true);
    },
  );
});
