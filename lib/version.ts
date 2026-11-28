import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Qué build sirve este proceso, para avisar que una página quedó vieja antes
 * de que sus Server Actions fallen con `UnrecognizedActionError`.
 *
 * El `BUILD_ID` de Next y no el commit: `SOURCE_COMMIT` de Coolify puede
 * llegar vacío. Sin el archivo (`next dev`), `null`.
 */
let version: string | null | undefined;

export function buildVersion(): string | null {
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
