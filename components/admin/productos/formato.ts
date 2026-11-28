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

// Aparte de `editor.tsx` para probar el pegado sin React.

/** Es la lista blanca de TECHNICAL-SPEC §16, no una copia. */
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
 * Al pegar se acepta también el guion bajo; no son formatos nuevos: al
 * guardar, `TRANSFORMADORES` los escribe con asteriscos.
 */
const TRANSFORMADORES_DE_PEGADO: Transformer[] = [
  ...TRANSFORMADORES,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_UNDERSCORE,
  ITALIC_UNDERSCORE,
];

/**
 * `h3`: en la ficha el nombre es el `h1` y «Descripción» el `h2`. El
 * sanitizador del servidor normaliza a este mismo nivel.
 */
export const SUBTITULO = "h3" as const;

// Ninguna cruza una línea en blanco: el énfasis no pasa de un párrafo a otro.
const BLOQUE = /^ {0,3}(?:[-*+]|\d{1,9}[.)]|#{1,6})[ \t]+\S/m;
const DOBLE = /(\*\*|__)(?=\S)(?:(?!\n[ \t]*\n)[\s\S])*?\S\1/;
// Sin letra ni número a los costados: `5*3*2` no es cursiva.
const ASTERISCO =
  /(?<![*\p{L}\p{N}])\*(?=[^\s*])(?:(?!\n[ \t]*\n)[^*])*?[^\s*]\*(?![*\p{L}\p{N}])/u;
const GUION_BAJO =
  /(?<![_\p{L}\p{N}])_(?=[^\s_])(?:(?!\n[ \t]*\n)[^_])*?[^\s_]_(?![_\p{L}\p{N}])/u;

/**
 * Un texto sin marcas no se convierte a propósito: la conversión une los
 * renglones seguidos, y en uno copiado de WhatsApp cada renglón es intencional.
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
 * Va dentro de una actualización del editor. Une los renglones seguidos, como
 * Markdown, y lleva todo subtítulo a `SUBTITULO`: un `h1` el editor no sabe
 * mostrarlo.
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
