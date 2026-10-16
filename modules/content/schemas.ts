import "server-only";

import { z } from "zod";

import { LIMITE_DE_TEXTO_LEGAL } from "@/modules/content/limites";
import { longitudDeTexto, sanitizarMarkdown } from "@/modules/content/markdown";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/**
 * Una página legal al guardarse — RF-29, §16.
 *
 * `server-only` como el esquema de productos, y por lo mismo: el texto se
 * SANITIZA como parte de la validación, y el sanitizador arrastra el
 * parseador de Markdown entero. El límite se mide después de sanitizar y
 * sobre el texto, no sobre la sintaxis.
 */
export const textoLegal = z.object({
  slug: z.enum(PAGINAS_LEGALES.map((p) => p.slug)),
  contenido: z
    .string()
    .transform(sanitizarMarkdown)
    // Vacía no: el pie enlaza a las cuatro, y una página en blanco es peor
    // que un 404 porque parece que no hay nada que decir.
    .refine((md) => longitudDeTexto(md) > 0, {
      message: "La página no puede quedar vacía.",
    })
    .refine((md) => longitudDeTexto(md) <= LIMITE_DE_TEXTO_LEGAL, {
      message: `El texto no puede pasar de ${LIMITE_DE_TEXTO_LEGAL.toLocaleString("es-AR")} caracteres.`,
    }),
});
