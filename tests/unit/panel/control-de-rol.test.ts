import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, test } from "vitest";

/**
 * F10.5 — Cada página del panel controla el rol por su cuenta. TS §13.3, §16.
 *
 * El layout de `/admin` no alcanza: Next renderiza la página en paralelo y
 * sus datos viajan aunque el layout dé 404 (ver `exigirAdmin` en
 * `lib/session.ts`, y `tests/e2e/panel-cerrado.spec.ts`, que prueba el
 * ataque de verdad). Este test es el que impide que una página nueva se
 * agregue sin el control: no hay que acordarse.
 *
 * Mira el texto del archivo y no el comportamiento —eso lo hace el E2E—,
 * así que corre en milisegundos y cubre todas las páginas, incluidas las
 * que el E2E no visita.
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
 * Lo primero que hace la función es `await exigirAdmin()`: antes de él solo
 * puede estar la firma. Si fuera después de leer algo, ese algo ya habría
 * corrido para quien no es administradora.
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
