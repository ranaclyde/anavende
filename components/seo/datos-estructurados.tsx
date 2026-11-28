import { serializeJsonLd, type Jsonld } from "@/lib/structured-data";

/**
 * Datos estructurados (RNF-04). Van en el cuerpo y no en el `<head>`: Google
 * los lee igual y cada pantalla declara lo suyo.
 *
 * `dangerouslySetInnerHTML` a propósito: como hijo, React escaparía las
 * comillas a `&quot;` y el JSON dejaría de parsear. El `<` lo escapa `serializeJsonLd`.
 */
export function DatosEstructurados({ datos }: { datos: Jsonld | Jsonld[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(datos) }}
    />
  );
}
