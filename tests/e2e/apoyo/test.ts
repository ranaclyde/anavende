import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

// Todo lo demás, tal cual: los tipos (`Page`, `Request`…) y `expect`. El
// `test` de abajo tapa al de Playwright, que es lo único que cambia.
export * from "@playwright/test";

/**
 * El `test` de los E2E, con un control más: **la CSP no bloqueó nada** —
 * TECHNICAL-SPEC §16, F10.5.
 *
 * La política de `next.config.ts` enumera de dónde se pueden cargar scripts,
 * imágenes y conexiones. Si un día una pantalla necesita un origen que no
 * está —un widget, Turnstile en F10.5b, otro host de fotos—, el navegador lo
 * bloquea en silencio: la consola dice «Refused to…» y la página se ve rota
 * sin ningún error del lado del servidor. Con esto, el test que pasa por esa
 * pantalla falla y dice qué se bloqueó.
 *
 * Mira la consola de **todos** los contextos, no solo el de la fixture
 * `page`: varios recorridos abren otro navegador para la compradora o la
 * visitante (`browser.newContext()`).
 */

const bloqueos: string[] = [];

function vigilar(contexto: BrowserContext): void {
  contexto.on("console", (mensaje) => {
    const texto = mensaje.text();
    if (texto.includes("Content Security Policy")) bloqueos.push(texto);
  });
}

export const test = base.extend<
  { vigilarContexto: void },
  { browser: Browser }
>({
  browser: [
    async ({ browser }, use) => {
      const crear = browser.newContext.bind(browser);
      browser.newContext = async (opciones) => {
        const contexto = await crear(opciones);
        vigilar(contexto);
        return contexto;
      };
      await use(browser);
    },
    { scope: "worker" },
  ],

  vigilarContexto: [
    async ({ context }, use) => {
      vigilar(context);
      await use();
      const encontrados = bloqueos.splice(0);
      expect(encontrados, "la CSP bloqueó algo").toEqual([]);
    },
    { auto: true },
  ],
});
