import { expect, test, type Page, type Request } from "./apoyo/test";

import { datosDePrueba, sufijo, type Cuenta, type Orden } from "./apoyo/datos";
import { ingresar } from "./apoyo/sesion";

/**
 * F10.5 — Un comprador no lee nada del panel. TS §13.3, §16.
 *
 * **Es el ataque que se encontró en el repaso de seguridad, repetido tal
 * cual.** Hasta F10.5 el rol se controlaba solo en el layout de `/admin`, y
 * Next renderiza el layout y la página en paralelo:
 *
 * - Un comprador pidiendo `/admin/usuarios` recibía un 404, **pero con los
 *   datos de la página adentro del HTML**: el email de otra cuenta estaba en
 *   la respuesta.
 * - Repitiendo la petición que hace el navegador al navegar dentro del panel
 *   (RSC, con `Next-Router-State-Tree`), el layout ni corría: 200 y la página
 *   entera.
 *
 * Se mira el contenido de la respuesta y no el código: un 404 que trae los
 * datos es justamente lo que pasaba. La marca es el nombre —único— de una tercera
 * cuenta, que solo puede aparecer si el panel la listó.
 *
 * Las cabeceras de la navegación se capturan de una administradora de verdad,
 * porque no son secretas: cualquiera que haya visto el panel las conoce.
 */

test.describe.configure({ mode: "serial" });

const datos = datosDePrueba();
let admin: Cuenta;
let comprador: Cuenta;
let tercera: Cuenta;
let orden: Orden;

test.beforeAll(async () => {
  admin = await datos.unaCuenta("Ana", "admin");
  comprador = await datos.unaCuenta("Curioso");
  tercera = await datos.unaCuenta(`Tercera${sufijo()}`);

  const marcaId = await datos.unaMarca(`Marca ${sufijo()}`);
  const categoriaId = await datos.unaCategoria(`Rubro ${sufijo()}`);
  const color = await datos.unColor(`Color ${sufijo()}`, "#123456");
  const producto = await datos.unProducto({
    nombre: `Producto ${sufijo()}`,
    marca: "Marca",
    marcaId,
    categoriaId,
    precio: "1000.00",
    colores: [color],
    stock: 3,
  });
  orden = await datos.unaOrden(tercera, [
    {
      producto,
      variante: producto.variantes[0],
      cantidad: 1,
      precio: "1000.00",
    },
  ]);
});

test.afterAll(async () => {
  await datos.desarmar();
});

/**
 * Las páginas del panel que muestran datos de la tercera cuenta. El inicio
 * no está: muestra números y no nombres, así que no hay marca que buscar. Que
 * todas las páginas tengan el control lo dice `control-de-rol.test.ts`.
 */
function paginas(): string[] {
  return [
    "/admin/usuarios",
    `/admin/usuarios/${tercera.id}`,
    "/admin/ordenes",
    `/admin/ordenes/${orden.numero}`,
  ];
}

/** La navegación interna a `ruta`, tal como la pide el navegador. */
async function navegacion(pagina: Page, ruta: string): Promise<Request> {
  const [pedido] = await Promise.all([
    pagina.waitForRequest(
      (r) => new URL(r.url()).pathname === ruta && !!r.headers()["rsc"],
    ),
    pagina.evaluate((r) => {
      // El enrutador de Next: lo mismo que hace un `<Link>` al tocarlo.
      (
        window as unknown as { next: { router: { push(r: string): void } } }
      ).next.router.push(r);
    }, ruta),
  ]);
  return pedido;
}

test("la administradora sí ve a la tercera cuenta", async ({ page }) => {
  await ingresar(page, admin);
  for (const ruta of paginas()) {
    const respuesta = await page.request.get(ruta);
    expect(respuesta.status(), ruta).toBe(200);
    expect(await respuesta.text(), ruta).toContain(tercera.nombre);
  }
});

test("un comprador no la ve, ni pidiendo la página ni navegando", async ({
  page,
  browser,
}) => {
  // Las cabeceras de una navegación verdadera dentro del panel.
  await ingresar(page, admin);
  await page.goto("/admin");
  const capturadas: Record<string, Record<string, string>> = {};
  for (const ruta of paginas()) {
    const pedido = await navegacion(page, ruta);
    const {
      cookie,
      host,
      "content-length": largo,
      ...cabeceras
    } = await pedido.allHeaders();
    void [cookie, host, largo];
    capturadas[ruta] = cabeceras;
  }

  const curioso = await (await browser.newContext()).newPage();
  try {
    await ingresar(curioso, comprador);

    for (const ruta of paginas()) {
      const comun = await curioso.request.get(ruta, { maxRedirects: 0 });
      expect(comun.status(), ruta).toBe(404);
      expect(await comun.text(), ruta).not.toContain(tercera.nombre);

      const cabeceras = capturadas[ruta];
      if (!cabeceras) continue;
      const rsc = await curioso.request.get(`${ruta}?_rsc=e2e`, {
        headers: cabeceras,
        maxRedirects: 0,
      });
      expect(await rsc.text(), `${ruta} por RSC`).not.toContain(tercera.nombre);
    }
  } finally {
    await curioso.context().close();
  }
});
