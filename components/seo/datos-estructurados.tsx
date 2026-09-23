import { aJson, type Jsonld } from "@/lib/datos-estructurados";

/**
 * Pinta datos estructurados en la página — F3.9, RNF-04.
 *
 * **Va en el cuerpo y no en el `<head>`**, que es lo que recomienda Google
 * desde que existe el renderizado por componentes: el rastreador ejecuta la
 * página entera y lo encuentra igual, y así cada pantalla declara lo suyo sin
 * tener que llegar al layout.
 *
 * **`dangerouslySetInnerHTML` es la única forma correcta acá**, y no es una
 * concesión: React escapa el texto de un hijo como HTML —las comillas saldrían
 * como `&quot;`— y un JSON con entidades adentro no lo parsea nadie.
 *
 * Lo que sí hay que escapar es `<`, y de eso se ocupa `aJson`: vive en el
 * módulo de al lado para poder probarse sin montar un componente.
 */
export function DatosEstructurados({ datos }: { datos: Jsonld | Jsonld[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: aJson(datos) }}
    />
  );
}
