import { z } from "zod";

/**
 * Los mensajes que Zod diría por su cuenta (en inglés), en castellano. Un
 * mensaje propio del esquema le gana siempre.
 *
 * Zod guarda la configuración en `globalThis`: se carga una vez en
 * `instrumentation.ts` y otra en `instrumentation-client.ts`.
 */
z.config({
  customError: (issue) => {
    if (issue.code === "too_big" && issue.origin === "string") {
      return `Puede tener hasta ${issue.maximum} caracteres.`;
    }
    if (issue.code === "too_small" && issue.origin === "string") {
      return issue.minimum === 1
        ? "Completá este dato."
        : `Tiene que tener al menos ${issue.minimum} caracteres.`;
    }
    return "Este dato no parece válido.";
  },
});
