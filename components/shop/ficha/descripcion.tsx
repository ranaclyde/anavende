import type {
  BlockContent,
  DefinitionContent,
  List,
  PhrasingContent,
} from "mdast";
import { Fragment } from "react";

import { nodosDeMarkdown } from "@/modules/content/markdown";

/**
 * La descripción del producto, con el formato que le dio la vendedora —
 * F3.5, RF-03, RF-15, TECHNICAL-SPEC §16, DESIGN-REFERENCE §6.11.
 *
 * **Se pinta como elementos de React, nunca como HTML.** No hay
 * `dangerouslySetInnerHTML` en ninguna parte del proyecto y esta era la
 * pantalla que lo habría necesitado: el árbol filtrado se recorre y cada
 * nodo se convierte en su etiqueta. Un `<script>` guardado en la base no
 * tiene por dónde llegar a ser un `<script>` en la página — no porque se lo
 * escape bien, sino porque nunca se lo trata como marcado.
 *
 * §16 pide filtrar **dos veces**: al guardar, para que la base no contenga lo
 * que no debe, y otra vez al pintar, para que ampliar o corregir la lista
 * blanca mañana no publique lo que ya está guardado. Esta es la segunda
 * pasada, y por eso llama a `nodosDeMarkdown` en vez de confiar en que lo
 * guardado ya esté limpio.
 *
 * Es un Server Component, y tiene que serlo: `modules/content/markdown` es
 * `server-only` —arrastra el parseador de Markdown entero— y nada de esto
 * cambia después del primer pintado.
 */
export function Descripcion({ markdown }: { markdown: string }) {
  const nodos = nodosDeMarkdown(markdown);

  // Una descripción vacía no dibuja el encabezado «Descripción» sobre nada.
  // El estado vacío de §8 no aplica: no falta una acción, falta un texto que
  // la vendedora puede no haber querido escribir.
  if (nodos.length === 0) return null;

  return (
    <section aria-labelledby="descripcion" className="pt-8">
      {/*
        «Sobre el producto» y no «Descripción» (2026-09-08): el rótulo
        anterior nombraba el campo de la base, no lo que la persona va a leer.
      */}
      <h2 id="descripcion" className="text-body-lg font-medium text-ink">
        Sobre el producto
      </h2>
      {/*
        `max-w-prose`: la ficha ya la mete en una columna angosta, pero este
        mismo componente sirve para cualquier ancho, y una descripción a
        1200px son renglones de 160 caracteres donde el ojo se pierde al
        volver al margen izquierdo.
      */}
      <div className="mt-3 flex max-w-prose flex-col gap-4 text-body-sm text-ink-secondary">
        {nodos.map((nodo, i) => (
          <Bloque key={i} nodo={nodo} />
        ))}
      </div>
    </section>
  );
}

/**
 * Los cuatro bloques que sobreviven al filtro de §16: párrafo, subtítulo,
 * lista con viñetas y lista numerada. El `default` no es defensivo de más —
 * es lo que hace que agregar un tipo al filtro mañana no pinte nada raro
 * mientras nadie escriba su caso acá.
 */
function Bloque({ nodo }: { nodo: BlockContent | DefinitionContent }) {
  switch (nodo.type) {
    case "paragraph":
      return (
        <p>
          <EnLinea nodos={nodo.children} />
        </p>
      );

    case "heading":
      // Siempre `h3` (RF-15, DR §6.11): el nombre del producto es el `h1` de
      // la página y «Descripción» el `h2`, así que un subtítulo acá adentro
      // es el escalón siguiente. El filtro ya normalizó la profundidad.
      return (
        <h3 className="text-body font-medium text-ink">
          <EnLinea nodos={nodo.children} />
        </h3>
      );

    case "list":
      return nodo.ordered ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-ink-tertiary">
          <Items nodo={nodo} />
        </ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-tertiary">
          <Items nodo={nodo} />
        </ul>
      );

    default:
      return null;
  }
}

function Items({ nodo }: { nodo: List }) {
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
              <Bloque key={j} nodo={hijo} />
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
