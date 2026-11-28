import "server-only";

import { fromMarkdown } from "mdast-util-from-markdown";
import type { Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import type { BlockContent, Nodes, PhrasingContent, Root } from "mdast";

// La lista blanca de TECHNICAL-SPEC §16: párrafo, salto, negrita, cursiva,
// listas y un nivel de subtítulo. Se filtra al guardar y al renderizar.
// Lo que se descarta no siempre se borra: un enlace pierde el enlace y conserva
// las palabras.

export { LIMITE_DE_TEXTO } from "@/modules/content/limites";

/** El producto es el `h1` de la ficha y «Descripción» el `h2`. */
const NIVEL_DE_SUBTITULO = 3;

/**
 * `description_text` (§5.4) quita `* _ #` para buscar, así que se emite solo
 * con esos marcadores. La viñeta `-` es a propósito: no molesta a la búsqueda.
 */
const SALIDA = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fences: false,
  rule: "-",
} as const;

// Dos funciones, bloque y línea, para que el tipo impida meter un bloque
// adentro de una negrita.

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

      case "inlineCode":
        salida.push({ type: "text", value: nodo.value });
        break;

      // Imágenes, HTML crudo y lo demás: no hay texto que rescatar.
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
        // Un párrafo que solo tenía una imagen queda vacío.
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

      case "blockquote":
        salida.push(...bloques(nodo.children));
        break;

      case "code":
        if (nodo.value.trim()) {
          salida.push({
            type: "paragraph",
            children: [{ type: "text", value: nodo.value }],
          });
        }
        break;

      // Tablas, HTML y lo que sume una extensión futura. La tabla se borra
      // entera: el editor es visual y la vendedora la ve desaparecer.
      default:
        break;
    }
  }

  return salida;
}

type Documento = Root & { children: BlockContent[] };

/**
 * Se parsea con GFM aunque no esté en la lista blanca: para descartar una
 * tabla hay que verla, o sale como párrafo con los pipes a la vista. Al
 * serializar no va `gfmToMarkdown`: del filtro no sale ningún nodo de GFM.
 */
const ENTRADA: FromMarkdownOptions = {
  extensions: [gfm()],
  mdastExtensions: [gfmFromMarkdown()],
};

function arbol(markdown: string): Documento {
  return {
    type: "root",
    children: bloques(fromMarkdown(markdown, ENTRADA).children),
  };
}

/** Al guardar. */
export function sanitizarMarkdown(markdown: string): string {
  // `toMarkdown` cierra con un salto: una descripción vacía quedaría `"\n"`.
  return toMarkdown(arbol(markdown), SALIDA).trim();
}

/** Al renderizar, como elementos de React: nunca pasa por HTML. */
export function nodosDeMarkdown(markdown: string): BlockContent[] {
  return arbol(markdown).children;
}

/**
 * Caracteres de texto, sin la sintaxis. No suma los saltos entre bloques y el
 * editor sí, a propósito: el servidor cuenta menos, así acepta todo lo que el
 * editor aceptó.
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
