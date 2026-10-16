import { BloquesDeTexto } from "@/components/shop/texto-con-formato";
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
        <BloquesDeTexto
          nodos={nodos}
          // `h3` (RF-15, DR §6.11): el nombre del producto es el `h1` y
          // «Sobre el producto» el `h2`.
          subtitulo={{
            nivel: "h3",
            className: "text-body font-medium text-ink",
          }}
        />
      </div>
    </section>
  );
}
