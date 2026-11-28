import type {
  BlockContent,
  DefinitionContent,
  List,
  PhrasingContent,
} from "mdast";
import { Fragment } from "react";

/**
 * El Markdown acotado pintado como elementos de React. Recibe el árbol ya
 * filtrado por `nodosDeMarkdown`: el sanitizador es `server-only`, así que
 * filtra quien llama.
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
 * Los bloques que sobreviven al filtro. El `default` hace que un tipo nuevo
 * en el filtro no pinte nada hasta que se escriba su caso.
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
      // El nivel lo decide la página y no el texto.
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
            Un ítem contiene bloques. El párrafo va sin `<p>`, para que la
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
