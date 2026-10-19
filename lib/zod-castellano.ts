import { z } from "zod";

/**
 * Los mensajes de Zod que nadie escribió, en castellano — DESIGN-REFERENCE
 * §10, F10.7.
 *
 * Cada campo que una persona completa tiene su mensaje propio en su esquema.
 * Esto es la red de abajo: lo que Zod diría por su cuenta, que en la versión
 * 4 es inglés técnico —«Too big: expected string to have <=72 characters»— y
 * que el envoltorio de acciones cuelga del campo tal cual (`lib/action.ts`,
 * paso 3). F10.7 encontró uno al alcance de cualquiera: pegar una contraseña
 * de más de 72 caracteres en «Contraseña actual».
 *
 * Un mensaje propio del esquema le gana siempre a éste: Zod solo usa
 * `customError` cuando el campo no trae el suyo.
 *
 * La configuración vive en `globalThis` (Zod la guarda ahí), así que basta
 * con cargarla una vez en el servidor (`instrumentation.ts`) y una en el
 * navegador (`instrumentation-client.ts`).
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
