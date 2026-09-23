import type { MetadataRoute } from "next";

import { urlAbsoluta } from "@/lib/seo";

/**
 * `robots.txt` — F3.9, RNF-04.
 *
 * **Lo que se prohíbe acá es lo que no es una página**: el panel, la API, las
 * plantillas de email. Nada de eso tiene contenido para nadie que busque
 * teclados, y rastrearlo es gastar el presupuesto de rastreo en puertas
 * cerradas.
 *
 * **Lo privado del comprador NO está en esta lista, y es a propósito.** El
 * carrito, el checkout y «Mi cuenta» se mantienen fuera del índice con
 * `robots: { index: false }` en su propia pantalla, que es la única
 * instrucción que además saca lo que ya esté indexado. Prohibir el rastreo
 * haría lo contrario de lo que parece: Googlebot no entraría, no leería ese
 * `noindex`, y una dirección enlazada desde afuera podría quedar en el índice
 * para siempre sin que nadie pueda pedir que salga.
 *
 * **Con la tienda cerrada esto devuelve 503**, como el resto del sitio
 * (F2.7b): el proxy no exceptúa `/robots.txt`. Es lo correcto —un buscador lee
 * 503 como «volvé más tarde» y no toca lo que ya tiene indexado—, y es también
 * el motivo por el que el modo mantenimiento no puede quedar puesto semanas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Tiene su propia guardia de rol y devuelve 404 a quien no la tenga
        // (F1.12); lo que se evita acá es el ruido, no una filtración.
        "/admin",
        // Enlaces de los emails y chequeo de salud. Ninguno es una página.
        "/api",
        // El HTML que baja GoTrue para mandar los emails (F1.8).
        "/emails",
      ],
    },
    sitemap: urlAbsoluta("/sitemap.xml"),
  };
}
