import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Qué build está sirviendo este proceso (2026-11-17).
 *
 * Una página abierta antes de un despliegue sigue llamando a las Server
 * Actions con los códigos de su build, y el servidor nuevo no los reconoce:
 * «Guardar» falla con `UnrecognizedActionError`. Para avisar ANTES de eso, la
 * página trae la versión con la que se pintó y la compara con la que
 * contesta `/api/salud` (`components/admin/aviso-de-version.tsx`).
 *
 * **Es el `BUILD_ID` de Next y no el commit.** `SOURCE_COMMIT` llega solo si
 * en Coolify está prendido «Include Source Commit in Build», y vacío no
 * distinguiría dos despliegues. El `BUILD_ID` lo escribe cada `next build`,
 * distinto cada vez, y `output: 'standalone'` lo copia junto al servidor.
 *
 * Se lee una vez por proceso: no cambia mientras el proceso vive, porque un
 * despliegue es un contenedor nuevo. Si el archivo no está —`next dev` lo
 * puede no tener—, `null`, y el aviso no se arma.
 */
let version: string | null | undefined;

export function versionDelBuild(): string | null {
  if (version === undefined) {
    try {
      version =
        readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() ||
        null;
    } catch {
      version = null;
    }
  }
  return version;
}
