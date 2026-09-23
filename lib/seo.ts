import { urlDelSitio } from "@/lib/env";

/**
 * Lo compartido entre metadatos, datos estructurados y mapa del sitio — F3.9,
 * RNF-04.
 *
 * Existe por el mismo motivo que `urlDelSitio()`: la frase de la zona de
 * entrega ya estaba escrita cuatro veces en cuatro metadatos distintos, y una
 * de ellas traía un salto de línea adentro. Cuatro copias de la misma frase es
 * cómo se termina teniendo cuatro frases.
 *
 * **No lleva `server-only`**: `sitemap.ts` y `robots.ts` no son componentes de
 * servidor, y nada de acá toca la base ni un secreto.
 */

/** El nombre que va en `og:site_name` y en el `template` del título. */
export const NOMBRE_DEL_SITIO = "AnaVende";

/**
 * RN-10, y la frase que más se repite del sitio. Acá vive **la de los
 * metadatos**: la que se lee en el resultado de Google o abajo del enlace en
 * WhatsApp. Las de las pantallas son otras —cada una está escrita para su
 * lugar— y no se unifican con ésta.
 */
export const ZONA_DE_ENTREGA =
  "Entrega en Viedma, Carmen de Patagones y alrededores.";

/**
 * Lo que entra en una meta description, cortado donde termina una palabra.
 *
 * El tope es 155 porque es lo que Google muestra antes de cortar con puntos
 * suspensivos; pasarse no es un error, es texto que no se lee. **Se corta en
 * el espacio anterior y no a los 155 exactos**: partir «auricul» a la mitad se
 * nota, y lo que queda en pantalla no dice nada más que lo que ya decía.
 *
 * Los saltos de línea y los espacios repetidos se aplastan antes: la
 * descripción sale de lo que escribió la vendedora en el panel, con sus
 * renglones, y en un `<meta>` un renglón es solo un espacio de más.
 */
export function resumenDeMetadatos(texto: string, tope = 155): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= tope) return limpio;

  // -1: el corte deja lugar para el carácter de puntos suspensivos.
  const recorte = limpio.slice(0, tope - 1);
  const espacio = recorte.lastIndexOf(" ");

  // Sin espacios adentro —una palabra sola larguísima— se corta igual: es
  // preferible a devolver el texto entero, que es lo que pasaría con un
  // `slice` condicionado al espacio.
  return `${(espacio > 0 ? recorte.slice(0, espacio) : recorte).replace(/[\s,.;:—-]+$/, "")}…`;
}

/**
 * Una ruta del sitio como URL absoluta.
 *
 * Los metadatos de Next resuelven las rutas relativas contra `metadataBase`,
 * así que ahí no hace falta. Hace falta en todo lo demás: los datos
 * estructurados y el mapa del sitio piden URLs enteras, y una relativa adentro
 * de un JSON-LD no la resuelve nadie.
 */
export function urlAbsoluta(ruta: string): string {
  return `${urlDelSitio()}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

/**
 * Lo que toda vista previa comparte — F3.9.
 *
 * **Existe porque los metadatos de Next se pisan, no se mezclan**: la pantalla
 * que declara su propio `openGraph` reemplaza el del layout ENTERO, así que
 * sin esto cada página tendría que acordarse de repetir el nombre del sitio y
 * el idioma, y la que se olvide sale sin ellos. Se esparce con `...` en cada
 * `openGraph` y lo propio de la pantalla va después.
 *
 * `es_AR` con guion bajo: Open Graph usa el formato de locale de Facebook, no
 * el de la etiqueta `lang` del HTML, que lleva guion medio.
 */
export const OPEN_GRAPH_BASE = {
  // `as const` sobre el campo y no sobre el objeto entero: Next distingue los
  // tipos de Open Graph por este literal, y un `as const` afuera dejaría el
  // arreglo de imágenes como `readonly`, que su tipo no acepta.
  type: "website" as const,
  siteName: NOMBRE_DEL_SITIO,
  locale: "es_AR",
  /**
   * La tarjeta de la marca, para toda pantalla que no tenga una foto mejor
   * —la ficha sí la tiene, y la pisa—. La genera `scripts/derivar-og.mts`.
   *
   * **Se nombra acá y no se deja a `app/opengraph-image.png`**, que es la vía
   * que Next trae: esa imagen se suma a los metadatos del layout, y cualquier
   * pantalla que declare su propio `openGraph` lo reemplaza entero y se queda
   * sin ella. Comprobado en el navegador: con el archivo puesto, la home y el
   * catálogo salían sin `og:image`.
   */
  images: [
    { url: "/marca/og.png", width: 1200, height: 630, alt: NOMBRE_DEL_SITIO },
  ],
};

/**
 * «Esta página no va al índice» — F3.9.
 *
 * Lo llevan el carrito, el checkout, la orden registrada, «Mi cuenta» entera,
 * las pantallas de sesión y la de mantenimiento: son de una persona y de un
 * momento, no del sitio. Ninguna aporta nada a quien busca teclados, y varias
 * ni siquiera responden lo mismo dos veces.
 *
 * **No se prohíben en `robots.txt`, y ahí está la diferencia.** Un `Disallow`
 * impide entrar, no indexar: la dirección puede quedar igual en el índice si
 * alguien la enlaza, y el buscador nunca va a leer que no la queremos porque
 * nunca va a entrar a leerla. Esta etiqueta es la que sí saca, y para eso el
 * rastreo tiene que estar permitido.
 *
 * `follow: false` porque no hay a dónde ir desde acá que no se alcance desde
 * el catálogo, que es la puerta que sí queremos que se recorra.
 */
export const FUERA_DEL_INDICE = { index: false, follow: false } as const;
