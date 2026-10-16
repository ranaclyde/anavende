import type {
  BlockContent,
  DefinitionContent,
  List,
  PhrasingContent,
} from "mdast";
import { Fragment } from "react";

/**
 * El Markdown acotado de §16 pintado como elementos de React — RF-15, RF-29.
 *
 * Lo comparten la descripción del producto (`ficha/descripcion.tsx`) y las
 * páginas legales: un formato, un sanitizador, un renderizador. Recibe el
 * árbol YA filtrado por `nodosDeMarkdown`; filtrar es de quien llama, que es
 * un Server Component, porque el sanitizador es `server-only`.
 */

export type Subtitulo = {
  nivel: "h2" | "h3";
  className: string;
};

export function BloquesDeTexto({
  nodos,
  subtitulo,
}: {
  nodos: readonly BlockContent[];
  subtitulo: Subtitulo;
}) {
  return (
    <>
      {nodos.map((nodo, i) => (
        <Bloque key={i} nodo={nodo} subtitulo={subtitulo} />
      ))}
    </>
  );
}

/**
 * Los cuatro bloques que sobreviven al filtro de §16: párrafo, subtítulo,
 * lista con viñetas y lista numerada. El `default` no es defensivo de más —
 * es lo que hace que agregar un tipo al filtro mañana no pinte nada raro
 * mientras nadie escriba su caso acá.
 */
function Bloque({
  nodo,
  subtitulo,
}: {
  nodo: BlockContent | DefinitionContent;
  subtitulo: Subtitulo;
}) {
  switch (nodo.type) {
    case "paragraph":
      return (
        <p>
          <EnLinea nodos={nodo.children} />
        </p>
      );

    case "heading": {
      // El nivel lo decide la página y no el texto: en la ficha el subtítulo
      // es `h3` —el nombre del producto es el `h1` y «Sobre el producto» el
      // `h2`—, y en una página legal es `h2`, porque ahí no hay nada en el
      // medio. El filtro ya normalizó la profundidad guardada.
      const Etiqueta = subtitulo.nivel;
      return (
        <Etiqueta className={subtitulo.className}>
          <EnLinea nodos={nodo.children} />
        </Etiqueta>
      );
    }

    case "list":
      return nodo.ordered ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-ink-tertiary">
          <Items nodo={nodo} subtitulo={subtitulo} />
        </ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-tertiary">
          <Items nodo={nodo} subtitulo={subtitulo} />
        </ul>
      );

    default:
      return null;
  }
}

function Items({ nodo, subtitulo }: { nodo: List; subtitulo: Subtitulo }) {
  return (
    <>
      {nodo.children.map((item, i) => (
        <li key={i}>
          {/*
            Un ítem contiene BLOQUES, no texto: el filtro deja adentro
            párrafos y hasta otra lista. Se recorre igual que el nivel de
            arriba, y el párrafo suelto no lleva `<p>` propio para que la
            viñeta no quede separada de su renglón.
          */}
          {item.children.map((hijo, j) =>
            hijo.type === "paragraph" ? (
              <EnLinea key={j} nodos={hijo.children} />
            ) : (
              <Bloque key={j} nodo={hijo} subtitulo={subtitulo} />
            ),
          )}
        </li>
      ))}
    </>
  );
}

/** Lo que vive dentro de un renglón: texto, salto, negrita y cursiva. */
function EnLinea({ nodos }: { nodos: readonly PhrasingContent[] }) {
  return (
    <>
      {nodos.map((nodo, i) => {
        switch (nodo.type) {
          case "text":
            return <Fragment key={i}>{nodo.value}</Fragment>;

          case "break":
            return <br key={i} />;

          case "strong":
            return (
              <strong key={i} className="font-medium text-ink">
                <EnLinea nodos={nodo.children} />
              </strong>
            );

          case "emphasis":
            return (
              <em key={i}>
                <EnLinea nodos={nodo.children} />
              </em>
            );

          default:
            return null;
        }
      })}
    </>
  );
}
