import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

// El `test` de abajo tapa al de Playwright; el resto se reexporta tal cual.
export * from "@playwright/test";

/**
 * El `test` de los E2E, con un control más: la CSP no bloqueó nada
 * (TECHNICAL-SPEC §16). Un origen que falta en `next.config.ts` el navegador
 * lo bloquea en silencio, solo con un aviso en la consola y sin error del
 * lado del servidor.
 *
 * Mira la consola de todos los contextos, no solo el de `page`: varios
 * recorridos abren otro con `browser.newContext()`.
 */

const bloqueos: string[] = [];

/**
 * Las guías arrancan vistas en todos los contextos: si no, su fondo
 * oscurecido tapa la pantalla. `ayudas.spec.ts` las prueba con
 * `test.use({ ayudasVistas: false })`.
 *
 * La clave y los ids copian los de `components/ui/ayuda-guiada.tsx` y sus
 * pantallas: si cambian allá, los recorridos fallan por el fondo.
 */
const GUIAS = [
  "ficha",
  "checkout",
  "mis-compras",
  "detalle-compra",
  "panel-orden",
  "panel-orden-nueva",
  "panel-producto",
  "panel-devoluciones",
];

async function marcarGuiasVistas(contexto: BrowserContext): Promise<void> {
  await contexto.addInitScript((vistas) => {
    try {
      localStorage.setItem("anavende:ayudas:v1", JSON.stringify(vistas));
    } catch {
      // Una página sin almacenamiento tampoco abre la guía sola.
    }
  }, GUIAS);
}

function vigilar(contexto: BrowserContext): void {
  contexto.on("console", (mensaje) => {
    const texto = mensaje.text();
    if (texto.includes("Content Security Policy")) bloqueos.push(texto);
  });
}

export const test = base.extend<
  { vigilarContexto: void },
  { browser: Browser; ayudasVistas: boolean }
>({
  // Del worker: la fixture `context` también nace de `browser.newContext`,
  // que es donde se marcan.
  ayudasVistas: [true, { option: true, scope: "worker" }],

  browser: [
    async ({ browser, ayudasVistas }, use) => {
      const crear = browser.newContext.bind(browser);
      browser.newContext = async (opciones) => {
        const contexto = await crear(opciones);
        vigilar(contexto);
        if (ayudasVistas) await marcarGuiasVistas(contexto);
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
