import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest — TECHNICAL-SPEC §2.1, §17.1.
 *
 * Los tests de stock y órdenes corren contra POSTGRES DE VERDAD, no contra un
 * doble de prueba: lo que se verifica son transacciones, `CHECK` constraints y
 * condiciones de carrera, y nada de eso lo reproduce un *mock*. Cuál es esa
 * Postgres lo decide `.env.test`, y `tests/setup/entorno.ts` se asegura de que
 * sea el stack local y no producción.
 */

const raiz = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // El alias del tsconfig, con la barra incluida en el patrón: sin ella
      // `@lexical/react` también empieza con `@` y terminaría reescrito.
      { find: /^@\//, replacement: raiz },
    ],
  },

  ssr: {
    resolve: {
      // Media aplicación lleva `server-only` (§4). Su `package.json` exporta
      // un módulo vacío bajo la condición `react-server` y uno que explota
      // bajo el resto, así que sin esto no se puede importar ni un módulo.
      //
      // Esto cubre lo que transforma Vite. Lo que vive en `node_modules` lo
      // externaliza y lo resuelve NODE, que no mira esta lista: de ahí el
      // `NODE_OPTIONS=--conditions=react-server` del script `test` en
      // `package.json`. Son dos resolvedores distintos y hacen falta los dos.
      conditions: ["react-server", "import", "default"],
    },
  },

  test: {
    // `tests/e2e/` es de Playwright (desde F10.1) y no lo levanta Vitest.
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup/entorno.ts"],

    /**
     * UN ARCHIVO POR VEZ, y no es por lentitud.
     *
     * Todos los archivos comparten la misma base. Dos corriendo a la vez se
     * pisan los datos: el que limpia al terminar borra las filas del otro, y
     * el resultado es un test que falla una vez cada diez sin que nadie pueda
     * reproducirlo. La concurrencia que SÍ hay que probar —dos reservas sobre
     * la última unidad (Compuerta F4)— se arma con dos transacciones dentro de
     * un mismo test, que es donde se puede controlar.
     */
    fileParallelism: false,

    // Abrir conexiones y correr transacciones contra Docker no entra en los
    // 5 s por omisión, y un timeout corto se lee como «el test falla».
    testTimeout: 20_000,
    hookTimeout: 20_000,

    /**
     * Coverage, con `npm run test:coverage`.
     *
     * **Solo la lógica: `modules`, `lib` y `db`**, que es lo que estos tests
     * prueban. Las pantallas —`app` y `components`— las prueba Playwright
     * (`tests/e2e/`), que esta cuenta no ve: contarlas daba un 0 % que no
     * quería decir «sin probar», y el promedio bajaba al 29 % (2026-11-18).
     * **Sin mínimo exigido**, por ahora. El resumen sale en la terminal y el
     * detalle en `coverage/index.html`, que no se commitea.
     */
    coverage: {
      provider: "v8",
      include: ["db/**/*.ts", "lib/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}"],
      reporter: ["text-summary", "html"],
    },
  },
});
