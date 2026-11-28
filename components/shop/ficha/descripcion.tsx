import { DescripcionPlegable } from "@/components/shop/ficha/descripcion-plegable";
import { BloquesDeTexto } from "@/components/shop/texto-con-formato";
import { nodosDeMarkdown } from "@/modules/content/markdown";

/**
 * Se pinta como elementos de React, nunca como HTML. Filtra otra vez al
 * pintar aunque lo guardado ya esté limpio: es la segunda pasada de
 * TECHNICAL-SPEC §16.
 */
export function Descripcion({ markdown }: { markdown: string }) {
  const nodos = nodosDeMarkdown(markdown);

  if (nodos.length === 0) return null;

  return (
    // `scroll-mt-24`: al plegarla se vuelve acá, y el encabezado fijo
    // taparía el título.
    <section aria-labelledby="descripcion" className="scroll-mt-24">
      {/* «Sobre el producto»: lo que se lee, no el nombre del campo. */}
      <h2 id="descripcion" className="text-body-lg font-medium text-ink">
        Sobre el producto
      </h2>
      {/* `max-w-prose`: el componente sirve para cualquier ancho. */}
      {/* Larga, se pliega con «Mostrar más». */}
      <div className="mt-3 flex flex-col">
        <DescripcionPlegable>
          <div className="flex max-w-prose flex-col gap-4 text-body-sm text-ink-secondary">
            <BloquesDeTexto
              nodos={nodos}
              // El nombre del producto es el `h1` y «Sobre el producto» el `h2`.
              subtitulo={{
                nivel: "h3",
                className: "text-body font-medium text-ink",
              }}
            />
          </div>
        </DescripcionPlegable>
      </div>
    </section>
  );
}
