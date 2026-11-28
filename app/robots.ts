import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * **Lo privado del comprador NO está acá, a propósito**: va con `noindex` en
 * su pantalla. Prohibir el rastreo impediría que Googlebot lea ese `noindex`.
 *
 * Con la tienda cerrada esto devuelve 503: el mantenimiento no puede quedar
 * puesto semanas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Ruido, no una filtración: tiene su propia guardia de rol.
        "/admin",
        "/api",
        // El HTML que baja GoTrue para mandar los emails.
        "/emails",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
