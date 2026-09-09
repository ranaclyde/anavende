import { NextResponse } from "next/server";

/**
 * Healthcheck del contenedor — TECHNICAL-SPEC §18.1.
 *
 * Contesta 200 si el proceso de Next está vivo y atendiendo, y NADA MÁS.
 *
 * **No toca la base a propósito.** Un healthcheck que consulta Postgres
 * convierte cualquier hipo de la base —o de la red entre los dos servidores—
 * en un contenedor marcado como enfermo, que Docker reinicia, que vuelve a
 * fallar: el corte se multiplica en vez de contenerse. Lo que este endpoint
 * responde es «el servidor arrancó y sirve»; si la base está caída, eso lo
 * dice la página con su propio error, no un reinicio en cadena.
 *
 * `force-dynamic` para que no quede prerrenderizado en la construcción: un
 * healthcheck servido desde la caché diría que sí aunque el proceso estuviera
 * atascado.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ estado: "ok" }, { status: 200 });
}
