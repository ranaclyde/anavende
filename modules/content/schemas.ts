import "server-only";

import { z } from "zod";

import { LIMITE_DE_TEXTO_LEGAL } from "@/modules/content/limites";
import { longitudDeTexto, sanitizarMarkdown } from "@/modules/content/markdown";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/** `server-only`: sanitiza al validar, y el sanitizador arrastra el parseador. */
export const textoLegal = z.object({
  slug: z.enum(PAGINAS_LEGALES.map((p) => p.slug)),
  contenido: z
    .string()
    .transform(sanitizarMarkdown)
    // Vacía no: el pie enlaza a las cuatro.
    .refine((md) => longitudDeTexto(md) > 0, {
      message: "La página no puede quedar vacía.",
    })
    .refine((md) => longitudDeTexto(md) <= LIMITE_DE_TEXTO_LEGAL, {
      message: `El texto no puede pasar de ${LIMITE_DE_TEXTO_LEGAL.toLocaleString("es-AR")} caracteres.`,
    }),
});
