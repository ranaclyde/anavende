/**
 * Healthcheck del contenedor (TECHNICAL-SPEC §18.1). Es un archivo y no un
 * `node -e` porque Coolify corre el chequeo sin shell y rechaza `;|&$><`.
 * `.mjs` porque la imagen final no tiene TypeScript.
 *
 * Pide a `127.0.0.1` y no a `localhost`: el servidor escucha en IPv4 y
 * `localhost` puede resolver a `::1`, y el contenedor quedaría «enfermo».
 */
const puerto = process.env.PORT ?? "3000";
const url = `http://127.0.0.1:${puerto}/api/salud`;

// Por debajo de los 5 s del HEALTHCHECK y de Coolify: así corta este y lo dice.
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
