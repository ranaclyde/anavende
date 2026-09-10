/**
 * Healthcheck del contenedor — TECHNICAL-SPEC §18.1.
 *
 * Existe como ARCHIVO, y no como un `node -e "…"` de una línea, por algo que
 * apareció el 2026-09-10 en el primer despliegue: el chequeo de Coolify corre
 * el comando **directo adentro del contenedor, sin shell**, y rechaza `;`,
 * `|`, `&`, `$`, `>` y `<`. Una función flecha lleva un `>` en cada `=>`, y
 * las comillas de la URL dependen de cómo el panel parta la cadena — algo que
 * solo se averigua fallando. Un archivo no tiene nada de eso: el comando pasa
 * a ser `node scripts/salud.mjs`, sin un solo carácter discutible.
 *
 * Y de paso deja de haber dos copias del mismo chequeo, una en el `Dockerfile`
 * y otra escrita a mano en una interfaz web, que es donde se desincronizan.
 *
 * **Pide a `127.0.0.1` y no a `localhost`**, y no es lo mismo: el servidor
 * escucha en `0.0.0.0`, que es IPv4, y `localhost` puede resolver primero a
 * `::1`. Cuando eso pasa la conexión se rechaza, el contenedor se declara
 * enfermo estando perfecto, y en el log se lee un «connection refused» que
 * parece que la aplicación no arrancó.
 *
 * Es `.mjs` por lo mismo que `migrar.mjs`: acá adentro no hay TypeScript, la
 * imagen final no tiene con qué compilar, y no debería tenerlo.
 */
const puerto = process.env.PORT ?? "3000";
const url = `http://127.0.0.1:${puerto}/api/salud`;

// Cuatro segundos, por debajo de los cinco de `--timeout` del HEALTHCHECK y de
// los de Coolify: así el que corta es este, y deja dicho por qué.
try {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(4000) });

  if (!respuesta.ok) {
    console.error(`[salud] ${url} respondió ${respuesta.status}.`);
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error(`[salud] No se pudo consultar ${url}.`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
