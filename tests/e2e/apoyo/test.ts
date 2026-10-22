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

/**
 * **Las guías de F6.6 arrancan vistas** en todos los contextos: la primera
 * visita a la ficha, el checkout o «Mis compras» abre un globo con el fondo
 * oscurecido, y cada recorrido que pasa por ahí tendría que cerrarlo primero.
 * `ayudas.spec.ts` las prueba con `test.use({ ayudasVistas: false })`.
 *
 * La clave y los ids son los de `components/shop/ayuda-guiada.tsx` y sus
 * pantallas, escritos a mano: si cambian, la guía aparece en los recorridos
 * y el que pase por ahí falla por el fondo que no deja tocar.
 */
const GUIAS = ["ficha", "checkout", "mis-compras", "detalle-compra"];

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
  // Del worker y no del test: la fixture `context` de Playwright también
  // nace de `browser.newContext`, que es donde se marcan.
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
