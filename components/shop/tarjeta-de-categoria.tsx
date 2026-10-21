import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { cantidadDeProductos } from "@/modules/catalog/products/categorias";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";

/**
 * Las tarjetas de categoría — DR §7.1 y §7.6.
 *
 * **La cuadrada** es la de «Más categorías» de la home (F2.9) y la de
 * «Destacadas» en la página de categorías (F3.10): la tarjeta de producto en
 * chico, con la imagen propia de la categoría (FA-21) o su inicial. **La en
 * fila** es la de la lista de la A a la Z: la cuadrada se probó con nombres
 * reales el 2026-10-21 y a 320px deja 72px de texto, así que la lista larga
 * va de costado, con lugar para el nombre y la cantidad.
 *
 * Sin estado ni eventos: se pintan igual desde el servidor (la home) y desde
 * el buscador de la página, que es de cliente.
 */

type Categoria = {
  slug: string;
  nombre: string;
};

/** El recuadro hundido con la inicial, para la que no tiene imagen. */
function Inicial({ nombre, className }: { nombre: string; className: string }) {
  return (
    <span aria-hidden className={className}>
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

export function TarjetaCuadradaDeCategoria({
  categoria,
  imagenUrl,
  sizes,
  cantidad,
}: {
  categoria: Categoria;
  imagenUrl: string | null;
  /** El de cada grilla: la home y la página no la dibujan del mismo ancho. */
  sizes: string;
  /** Solo en la página de categorías; la home no la muestra. */
  cantidad?: number;
}) {
  return (
    <Link
      href={urlDeTienda({ categoria: [categoria.slug] })}
      className="group flex h-full flex-col gap-2 rounded-card bg-surface p-2 shadow-md transition-shadow duration-200 hover:shadow-lg focus-visible:shadow-focus focus-visible:outline-none"
    >
      {/* Cuadrada siempre, con imagen o sin ella: el aspecto lo
          reserva el CSS y la fila no salta cuando cargan (CLS). */}
      <span className="relative grid aspect-square place-items-center overflow-hidden rounded-image bg-surface-sunken">
        {imagenUrl ? (
          // Decorativa: el nombre va debajo, en texto, y
          // repetirlo en el `alt` lo haría leer dos veces (§9).
          <Image
            src={imagenUrl}
            alt=""
            fill
            sizes={sizes}
            className="object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <Inicial
            nombre={categoria.nombre}
            className="text-heading text-ink-tertiary"
          />
        )}
      </span>
      {cantidad === undefined ? (
        <span className="px-1 pb-1 text-body-sm font-medium break-words hyphens-auto text-ink transition-colors duration-150 group-hover:text-brand">
          {categoria.nombre}
        </span>
      ) : (
        <span className="flex flex-col gap-0.5 px-1 pb-1">
          <span className="text-body-sm font-medium break-words hyphens-auto text-ink transition-colors duration-150 group-hover:text-brand">
            {categoria.nombre}
          </span>
          <span className="text-caption text-ink-secondary">
            {cantidadDeProductos(cantidad)}
          </span>
        </span>
      )}
    </Link>
  );
}

/**
 * La fila de tarjetas cuadradas (2026-10-21, pedido tuyo). **En el teléfono
 * se desliza con el dedo**, con dos enteras y la tercera asomada, que es lo
 * que dice que sigue: tres por fila en un teléfono de 320 dejaban 72px para
 * el nombre y lo partían a mitad de palabra. **Desde `sm`, la grilla**, con
 * las columnas que pide cada pantalla en `grilla` (las clases van enteras
 * para que Tailwind las encuentre).
 *
 * Es la pista del `Carrusel` sin flechas y solo hasta `sm`: estirada hasta el
 * borde de la página (`-mx-4` con `px-4`) para que la tarjeta se vaya por el
 * costado en vez de cortarse contra el margen, y con `py-3` para que la
 * sombra no quede recortada. Sin JavaScript: se pinta igual desde el servidor.
 */
export function FilaDeCategorias({
  grilla,
  children,
}: {
  grilla: string;
  children: React.ReactNode;
}) {
  return (
    <ul
      className={`-mx-4 -my-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 py-3 scroll-px-4 [scrollbar-width:none] sm:mx-0 sm:my-0 sm:grid sm:overflow-visible sm:p-0 [&::-webkit-scrollbar]:hidden ${grilla}`}
    >
      {children}
    </ul>
  );
}

/** El ancho de cada `<li>` en la fila: 40% asoma un tercio de la tercera. */
export const ANCHO_EN_FILA_DE_CATEGORIAS =
  "w-[40%] shrink-0 snap-start sm:w-auto";

/**
 * La tarjeta en fila de §7.6. Con productos es un enlace entero al catálogo
 * filtrado; sin productos no enlaza —llevaría a una grilla vacía— y en su
 * lugar ofrece `accion`, el «Consultar» por WhatsApp.
 */
export function TarjetaEnFilaDeCategoria({
  categoria,
  miniaturaUrl,
  cantidad,
  accion,
}: {
  categoria: Categoria;
  miniaturaUrl: string | null;
  cantidad: number;
  /** Solo para la que no tiene productos. */
  accion?: React.ReactNode;
}) {
  const conProductos = cantidad > 0;

  const contenido = (
    <>
      {/* Sobre la tarjeta hundida, el recuadro va en superficie: hundido
          sobre hundido no se vería. */}
      <span
        className={
          conProductos
            ? "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-image bg-surface-sunken"
            : "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-image bg-surface"
        }
      >
        {miniaturaUrl ? (
          <Image
            src={miniaturaUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <Inicial
            nombre={categoria.nombre}
            className="text-body font-medium text-ink-tertiary"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Sin tope de renglones: el panel admite 60 caracteres, y con el
            ancho de la fila son dos o tres. Cortarlo escondería justo la
            parte que distingue a «Cables USB-C» de «Cables USB-C a HDMI». */}
        <span
          className={
            conProductos
              ? "text-body font-medium break-words text-ink transition-colors duration-150 group-hover:text-brand"
              : "text-body font-medium break-words text-ink"
          }
        >
          {categoria.nombre}
        </span>
        <span className="text-body-sm text-ink-secondary">
          {conProductos
            ? cantidadDeProductos(cantidad)
            : "Sin productos por ahora"}
        </span>
      </span>
    </>
  );

  if (conProductos) {
    return (
      <Link
        href={urlDeTienda({ categoria: [categoria.slug] })}
        className="group flex h-full min-h-18 items-center gap-4 rounded-card bg-surface p-2 pr-4 shadow-md transition-shadow duration-200 hover:shadow-lg focus-visible:shadow-focus focus-visible:outline-none"
      >
        {contenido}
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-ink-tertiary transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
        />
      </Link>
    );
  }

  /*
   * Lo que se atenúa es la SUPERFICIE —hundida y sin sombra—, no el texto,
   * que conserva el contraste AA (§9): una categoría sin productos sigue
   * siendo algo que se lee, y lo que se dice es que no se toca.
   *
   * «Consultar» va DEBAJO del texto y no a su derecha: al costado le sacaba
   * 120px al nombre, y a 320px uno de 60 caracteres se partía a mitad de
   * palabra («estuche-s»). El `pl-14` deja el ícono del botón, que trae 16px
   * propios, alineado con el texto de arriba.
   */
  return (
    <div className="flex h-full flex-col rounded-card bg-surface-sunken p-2 pr-4">
      <div className="flex min-h-14 items-center gap-4">{contenido}</div>
      {accion ? <div className="pl-14">{accion}</div> : null}
    </div>
  );
}
