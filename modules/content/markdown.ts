import "server-only";

import { fromMarkdown } from "mdast-util-from-markdown";
import type { Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import type {
  BlockContent,
  Nodes,
  PhrasingContent,
  Root,
} from "mdast";

/**
 * Markdown acotado: la lista blanca del proyecto — TECHNICAL-SPEC §16, RF-15.
 *
 * Es UN solo sanitizador para los dos textos con formato del sistema: la
 * descripción de producto (RF-15) y las páginas legales (§5.9). Un formato,
 * un sanitizador, un renderizador — la alternativa era abrir dos tuberías
 * para el mismo problema.
 *
 * Lo que sobrevive, y nada más:
 *
 *   párrafo · salto · negrita · cursiva · lista con viñetas · lista numerada
 *   · ítem de lista · un nivel de subtítulo
 *
 * §16 pide descartar **dos veces**: al guardar, para que la base nunca
 * contenga lo que no debe; y otra vez al renderizar, para que ampliar o
 * corregir esta lista mañana no publique lo que ya está guardado. Las dos
 * pasadas son esta misma función, por eso el árbol filtrado se exporta además
 * de la serialización.
 *
 * **Lo que se descarta no siempre se borra.** RF-15 pide que pegar desde Word
 * «descarte el resto sin romper el resto del texto»: un enlace pierde el
 * enlace y conserva las palabras, una cita pierde el marco y conserva los
 * párrafos. Se borra entero solo lo que no es texto —imágenes, HTML, tablas—,
 * porque ahí no hay nada legible que rescatar.
 */

/**
 * RF-15: hasta 5.000 caracteres de TEXTO, no de sintaxis. Se re-exporta
 * desde acá para que quien sanitiza no tenga que ir a buscarlo a otro lado;
 * vive en `limites.ts` porque el editor —que es cliente— también lo necesita
 * y este módulo es `server-only`.
 */
export { LIMITE_DE_TEXTO } from "@/modules/content/limites";

/**
 * El único nivel de subtítulo (RF-15, DR §6.11). En la ficha, el nombre del
 * producto es el `h1` y «Descripción» el `h2`: un subtítulo dentro de la
 * descripción es un `h3`. Todo encabezado pegado desde afuera —venga como
 * `#` o como `#####`— se normaliza a este nivel; el documento tiene un solo
 * escalón disponible y no hay jerarquía que preservar.
 */
const NIVEL_DE_SUBTITULO = 3;

/**
 * Serializar es la mitad de la garantía: `description_text` (§5.4) quita
 * `* _ #` para poder buscar, así que el Markdown se emite SIEMPRE con esos
 * marcadores y nunca con otros. La viñeta es la excepción a propósito: `-`
 * sobrevive a la proyección como texto y no molesta a una búsqueda por
 * subcadena, mientras que `*` desaparecería junto con la sintaxis.
 */
const SALIDA = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fences: false,
  rule: "-",
} as const;

// ── El filtro ───────────────────────────────────────────────────────────
//
// Dos funciones y no una: el contexto —bloque o línea— es explícito, así que
// desenvolver una cita (que devuelve párrafos) no puede terminar metiendo un
// bloque adentro de una negrita. Con una sola función recursiva esa
// equivocación compila.

function enLinea(nodos: readonly Nodes[]): PhrasingContent[] {
  const salida: PhrasingContent[] = [];

  for (const nodo of nodos) {
    switch (nodo.type) {
      case "text":
      case "break":
        salida.push(nodo);
        break;

      case "strong":
      case "emphasis":
        salida.push({ type: nodo.type, children: enLinea(nodo.children) });
        break;

      // Se desenvuelven: el formato se va, las palabras quedan.
      case "link":
      case "linkReference":
      case "delete":
        salida.push(...enLinea(nodo.children));
        break;

      // El código en línea no es un formato de la lista, pero su contenido
      // es texto que la vendedora escribió. Pasa a ser texto llano.
      case "inlineCode":
        salida.push({ type: "text", value: nodo.value });
        break;

      // Imágenes (RF-16 tiene las del producto, con su canalización), HTML
      // crudo y todo lo demás: no hay texto que rescatar.
      default:
        break;
    }
  }

  return salida;
}

function bloques(nodos: readonly Nodes[]): BlockContent[] {
  const salida: BlockContent[] = [];

  for (const nodo of nodos) {
    switch (nodo.type) {
      case "paragraph": {
        const hijos = enLinea(nodo.children);
        // Un párrafo que solo tenía una imagen queda vacío: no se emite, o
        // dejaría un renglón en blanco que nadie escribió.
        if (hijos.length) salida.push({ type: "paragraph", children: hijos });
        break;
      }

      case "heading": {
        const hijos = enLinea(nodo.children);
        if (hijos.length) {
          salida.push({
            type: "heading",
            depth: NIVEL_DE_SUBTITULO,
            children: hijos,
          });
        }
        break;
      }

      case "list": {
        const items = nodo.children
          .map((item) => ({
            type: "listItem" as const,
            // `checked` se pierde a propósito: la lista de tareas es GFM y
            // no está en la lista blanca.
            spread: item.spread,
            children: bloques(item.children),
          }))
          .filter((item) => item.children.length);

        if (items.length) {
          salida.push({
            type: "list",
            ordered: nodo.ordered,
            start: nodo.start,
            spread: nodo.spread,
            children: items,
          });
        }
        break;
      }

      // La cita pierde el marco y conserva sus párrafos.
      case "blockquote":
        salida.push(...bloques(nodo.children));
        break;

      // Un bloque de código conserva su texto, en un párrafo.
      case "code":
        if (nodo.value.trim()) {
          salida.push({
            type: "paragraph",
            children: [{ type: "text", value: nodo.value }],
          });
        }
        break;

      // Tablas, HTML crudo, líneas divisorias, definiciones, notas al pie y
      // cualquier cosa que aparezca el día que alguien sume una extensión:
      // fuera. La tabla se borra ENTERA y no se aplana a párrafos: aplanarla
      // sería inventar un formato que ninguna especificación pidió, y la
      // vendedora la ve desaparecer en el acto —el editor es visual—, así
      // que no es una pérdida silenciosa.
      default:
        break;
    }
  }

  return salida;
}

/**
 * El documento ya filtrado. `children` es más angosto que el `Root` de
 * mdast a propósito: después del filtro, un nodo que no sea de bloque no
 * puede existir, y el tipo lo dice.
 */
type Documento = Root & { children: BlockContent[] };

/**
 * Se PARSEA con GFM aunque GFM no esté en la lista blanca, y no es una
 * contradicción: para descartar una tabla primero hay que verla. Sin la
 * extensión, `| Tecla | Vida útil |` no es una tabla para el parseador sino
 * un párrafo, y sale del sanitizador tal cual —con los pipes a la vista— que
 * es justo el «resto roto» que RF-15 no quiere. Lo mismo con el tachado y
 * con una URL suelta, que GFM convierte en enlace y el filtro desenvuelve.
 *
 * Al SERIALIZAR no se agrega `gfmToMarkdown`: del filtro no sale ningún nodo
 * de GFM, así que un serializador que supiera escribirlos solo agregaría la
 * posibilidad de que algún día salga uno.
 */
const ENTRADA: FromMarkdownOptions = {
  extensions: [gfm()],
  mdastExtensions: [gfmFromMarkdown()],
};

/** Parsea y filtra. Es el núcleo: las tres funciones públicas salen de acá. */
function arbol(markdown: string): Documento {
  return {
    type: "root",
    children: bloques(fromMarkdown(markdown, ENTRADA).children),
  };
}

/**
 * Al GUARDAR (§16). Devuelve Markdown que solo contiene la lista blanca, con
 * los marcadores que `description_text` sabe quitar.
 */
export function sanitizarMarkdown(markdown: string): string {
  // `toMarkdown` cierra siempre con un salto, que en un archivo `.md` es la
  // convención y en una columna de texto es ruido: una descripción vacía
  // quedaría como `"\n"` y no como `""`, y dos textos iguales podrían
  // compararse distinto según de dónde vinieran. Se recorta.
  return toMarkdown(arbol(markdown), SALIDA).trim();
}

/**
 * Al RENDERIZAR (§16). El árbol ya filtrado, para pintarlo como elementos de
 * React: nunca se convierte a HTML ni se pasa por `dangerouslySetInnerHTML`,
 * así que no hay superficie de XSS que sanitizar aparte.
 */
export function nodosDeMarkdown(markdown: string): BlockContent[] {
  return arbol(markdown).children;
}

/**
 * Caracteres de TEXTO, para el límite de RF-15. Cuenta lo que la vendedora
 * escribió, no los asteriscos que puso el editor: si contáramos el Markdown,
 * poner en negrita un párrafo lo acercaría al límite sin agregar una letra.
 *
 * NO suma los saltos entre bloques, y el editor sí los cuenta —cuenta el
 * texto completo, con sus renglones—. La diferencia es deliberada y va en
 * esta dirección: el servidor cuenta MENOS que el editor, así que todo lo que
 * el editor acepta el servidor lo acepta. Al revés, la vendedora vería un
 * contador en verde y un rechazo al guardar.
 */
export function longitudDeTexto(markdown: string): number {
  let total = 0;

  const recorrer = (nodo: Nodes) => {
    if (nodo.type === "text") total += nodo.value.length;
    if ("children" in nodo) nodo.children.forEach(recorrer);
  };

  arbol(markdown).children.forEach(recorrer);
  return total;
}
