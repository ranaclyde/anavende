import {
  $generateNodesFromMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HEADING,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  ORDERED_LIST,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import type { LexicalNode } from "lexical";

/**
 * El formato del editor de la descripción — RF-15, TECHNICAL-SPEC §16.
 *
 * Vive aparte de `editor.tsx` para que el pegado se pueda probar sin React
 * (`tests/unit/content/pegar-markdown.test.ts`).
 */

/**
 * La lista de *transformadores* del editor: **es** la lista blanca de §16, no
 * una copia. Un formato que no está acá no tiene ida ni vuelta posible, así
 * que agregarlo por accidente no se puede.
 */
export const TRANSFORMADORES: Transformer[] = [
  HEADING,
  UNORDERED_LIST,
  ORDERED_LIST,
  // El combinado va primero: si `BOLD_STAR` mirara antes, `***texto***`
  // saldría como negrita con dos asteriscos sueltos alrededor.
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  ITALIC_STAR,
];

/**
 * Lo que se acepta AL PEGAR: la misma lista, más negrita y cursiva escritas
 * con guion bajo (`__negrita__`, `_cursiva_`), que también son Markdown y
 * aparecen en lo que se copia de otros lados. Son los mismos dos formatos, no
 * formatos nuevos: al guardar, `TRANSFORMADORES` los escribe con asteriscos,
 * así que lo guardado no cambia de forma.
 */
const TRANSFORMADORES_DE_PEGADO: Transformer[] = [
  ...TRANSFORMADORES,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_UNDERSCORE,
  ITALIC_UNDERSCORE,
];

/**
 * El único nivel de subtítulo (RF-15). `h3` y no `h2`: en la ficha el nombre
 * del producto es el `h1` y «Descripción» el `h2`, así que un subtítulo
 * adentro de la descripción es el escalón siguiente. El sanitizador del
 * servidor normaliza a este mismo nivel.
 */
export const SUBTITULO = "h3" as const;

// Las marcas que delatan Markdown escrito como texto. Ninguna cruza una línea
// en blanco: el énfasis de Markdown no pasa de un párrafo al siguiente.
const BLOQUE = /^ {0,3}(?:[-*+]|\d{1,9}[.)]|#{1,6})[ \t]+\S/m;
const DOBLE = /(\*\*|__)(?=\S)(?:(?!\n[ \t]*\n)[\s\S])*?\S\1/;
// Los simples piden algo que no sea letra ni número a los costados: así
// `5*3*2` o `nombre_de_archivo_viejo` no cuentan como cursiva.
const ASTERISCO =
  /(?<![*\p{L}\p{N}])\*(?=[^\s*])(?:(?!\n[ \t]*\n)[^*])*?[^\s*]\*(?![*\p{L}\p{N}])/u;
const GUION_BAJO =
  /(?<![_\p{L}\p{N}])_(?=[^\s_])(?:(?!\n[ \t]*\n)[^_])*?[^\s_]_(?![_\p{L}\p{N}])/u;

/**
 * ¿El texto pegado trae Markdown escrito? Es lo que decide si se convierte o
 * se pega como siempre.
 *
 * Un texto sin marcas se deja pasar a propósito, aunque convertirlo no lo
 * cambiaría: la conversión une los renglones seguidos en un solo párrafo, y
 * en un texto copiado de WhatsApp —«Incluye:↵Cable↵Mouse»— cada renglón es
 * intencional.
 */
export function pareceMarkdown(texto: string): boolean {
  return (
    BLOQUE.test(texto) ||
    DOBLE.test(texto) ||
    ASTERISCO.test(texto) ||
    GUION_BAJO.test(texto)
  );
}

/**
 * Los nodos que salen de un texto en Markdown, listos para insertar donde
 * está el cursor. Va dentro de una actualización del editor.
 *
 * - **Los renglones seguidos se unen** en un párrafo, como los lee Markdown.
 *   Sin eso, un párrafo cortado en varias líneas —lo que se copia de un
 *   archivo o de una terminal— quedaría en un párrafo por renglón, y una
 *   negrita que cruza un salto de línea no se reconocería.
 * - **Todo subtítulo pasa a `SUBTITULO`**: `# Título` crearía un `h1` que el
 *   editor no sabe mostrar y que el servidor igual bajaría a `h3`.
 * - Lo que no está en la lista blanca —enlaces, tablas, código— queda como
 *   texto, igual que si se escribiera a mano.
 */
export function $nodosDesdeMarkdown(texto: string): LexicalNode[] {
  return $generateNodesFromMarkdownString(
    texto,
    TRANSFORMADORES_DE_PEGADO,
    false,
    true,
  ).map((nodo) => {
    if (!$isHeadingNode(nodo) || nodo.getTag() === SUBTITULO) return nodo;
    const subtitulo = $createHeadingNode(SUBTITULO);
    subtitulo.append(...nodo.getChildren());
    return subtitulo;
  });
}
