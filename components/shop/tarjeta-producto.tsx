import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Precio } from "@/components/shop/precio";
import type { Money } from "@/lib/money";
import { urlDeImagen } from "@/modules/media/subir";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de producto — F3.1, DESIGN-REFERENCE §6.1.
 *
 * «El componente más importante del sistema. Aparece en catálogo, home,
 * recomendados y favoritos, y es SIEMPRE el mismo.» De ahí que reciba un
 * objeto plano y no una fila de la base: si tomara el tipo de una consulta,
 * cada pantalla nueva tendría que devolver exactamente esa forma o inventarse
 * una tarjeta parecida.
 *
 * Es un Server Component, y eso NO es un detalle: en una grilla de 24, hacerla
 * cliente mandaría al navegador 24 copias de este árbol más los datos para
 * rehidratarlo, para una tarjeta que no tiene ni un evento propio. Lo único
 * interactivo —el corazón de favoritos— entra por `accionFavorito`, que es una
 * isla de cliente que arma quien la use.
 */

export type ProductoEnTarjeta = {
  slug: string;
  nombre: string;
  /** Va en versalitas arriba del nombre (§6.1). */
  marca: string;
  precio: Money;
  descuento: Money;
  precioFinal: Money;
  /**
   * La CLAVE base en Storage, sin sufijo ni extensión (§9.2), o `null` si el
   * producto todavía no tiene fotos — F2.4 hace el alta en dos pasos, así que
   * ese estado existe de verdad y no es un caso inventado.
   */
  imagenKey: string | null;
  /** Para el texto alternativo: «…, negro» (§9). */
  color?: string | null;
  /**
   * Todos los colores en que existe el producto, para los puntos de §6.1.
   * Distinto de `color`, que es el de la foto que se está mostrando.
   */
  colores?: { nombre: string; hex: string }[];
  /** `stock_total − reserved_stock` sumado sobre las variantes (§8.1). */
  disponible: number;
};

type Props = {
  producto: ProductoEnTarjeta;
  /**
   * El corazón de RF-10, que llega recién en F5.4. Se recibe como nodo y no
   * como `onToggle` para que la tarjeta pueda seguir siendo servidor: la isla
   * de cliente la arma quien la pasa. Sin esto, no se dibuja nada — un corazón
   * que no hace nada es peor que ningún corazón.
   *
   * **El contrato visual ya está decidido y es de DR §6.1**, para que F5.4 no
   * tenga que inventarlo: arriba a la derecha de la imagen y SIEMPRE a la
   * vista —en un teléfono no hay hover—, contorno sin marcar y relleno
   * `--brand` marcado, área táctil de 44px, y el estado anunciado además del
   * relleno, porque un lector de pantalla no ve un ícono lleno. El burdeos y
   * no un rosa: §1.2 decidió un solo color saturado en todo el sistema.
   *
   * La tarjeta solo pone el lugar. Que esté FUERA del ancla lo resuelve acá
   * abajo el enlace estirado, y no es negociable: un `<a>` que envolviera la
   * tarjeta se llevaría el botón adentro.
   */
  accionFavorito?: ReactNode;
  /**
   * `true` en las primeras imágenes de la grilla. `next/image` difiere por
   * omisión, y diferir la que está arriba de todo penaliza el LCP: es la que
   * el navegador tendría que estar pidiendo primero.
   */
  prioridad?: boolean;
};

export function TarjetaProducto({ producto, accionFavorito, prioridad }: Props) {
  const { slug, nombre, marca, imagenKey, color, disponible } = producto;
  const colores = producto.colores ?? [];
  const sinStock = disponible <= 0;

  // §9: «producto, marca y color». Sin el color, dos tarjetas de la misma
  // ficha se anuncian idénticas.
  const alt = [nombre, marca].join(" ") + (color ? `, ${color.toLowerCase()}` : "");

  return (
    <article
      className={cn(
        // `h-full`: en la grilla, las tarjetas de una fila estiran a la más
        // alta, y sin esto la que tiene menos contenido queda corta y los
        // bordes de abajo bailan. El nombre ya reserva sus dos líneas más
        // abajo; esto cubre el resto.
        "group relative flex h-full flex-col rounded-card bg-surface p-3",
        // Sombra y no borde (§11): las tarjetas se separan por elevación.
        "shadow-md",
        // El anillo de foco rodea la TARJETA, no el enlace de adentro, que es
        // solo el texto del nombre y dejaría medio componente sin señalar.
        "has-[a:focus-visible]:shadow-focus",
        // 200ms para transformaciones (§8). `motion-safe` porque §8 pide que
        // todo movimiento se apague bajo `prefers-reduced-motion`, y ahí la
        // elevación sola sigue comunicando el hover.
        "transition-shadow duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "hover:shadow-lg motion-safe:hover:-translate-y-0.5",
        "motion-safe:transition-[box-shadow,transform]",
      )}
    >
      <div className="relative overflow-hidden rounded-image bg-surface-sunken">
        {/*
          Cuadrada siempre, aunque la foto no lo sea: el aspecto se reserva con
          CSS y no depende de que la imagen cargue, que es lo que evita que la
          grilla salte cuando llegan (CLS).
        */}
        <div className="relative aspect-square">
          {imagenKey ? (
            <Image
              src={urlDeImagen(imagenKey, "card")}
              alt={alt}
              fill
              // Le dice al navegador qué ancho va a ocupar ANTES de saber el
              // layout, así elige el archivo correcto en la primera pasada.
              // Son las tres columnas de §7.2: 2 / 3 / 4.
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              priority={prioridad}
              className={cn(
                "object-cover",
                "motion-safe:transition-transform motion-safe:duration-200",
                "motion-safe:group-hover:scale-[1.03]",
                // §6.1: la imagen baja a 55% cuando no hay stock. La píldora
                // de abajo es la que lo DICE — el color no alcanza (§9).
                sinStock ? "opacity-55" : "",
              )}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-caption text-ink-tertiary">Sin foto</span>
            </div>
          )}

          {/*
            NO hay píldora de descuento sobre la imagen. La llevaba, y repetía
            el monto que la tarjeta ya mostraba abajo: cuatro números para
            comunicar una sola oferta. El tachado junto al precio en burdeos ya
            dice que hay rebaja — es como lo resuelve el canvas aprobado en
            F3.8, y desde el 2026-09-08 es la regla de toda la tienda y no solo
            de la tarjeta (RN-04c).
          */}
          {sinStock ? (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface/92 px-3 py-1.5 text-caption font-medium whitespace-nowrap text-ink shadow-md">
              Sin stock
            </p>
          ) : null}

          {/*
            Encima del enlace estirado, y a la vista SIEMPRE: revelarlo al pasar
            el mouse lo dejaría inalcanzable en un teléfono, donde no hay hover.
          */}
          {accionFavorito ? (
            <div className="absolute top-2 right-2 z-10">{accionFavorito}</div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-1 pt-3 pb-1">
        <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
          {marca}
        </p>

        <h3 className="text-body-sm font-medium text-ink">
          {/*
            ENLACE ESTIRADO. La tarjeta entera es clicable (§6.1) y el ancla
            vive acá adentro: envolver todo en un `<a>` metería el botón de
            favoritos DENTRO del enlace, que es HTML inválido y deja el corazón
            inalcanzable con teclado. El pseudo-elemento cubre la tarjeta sin
            anidar nada.

            `line-clamp-2` con el alto reservado: sin él, un nombre de una línea
            y otro de dos dejan los precios de la fila a distinta altura.
          */}
          <Link
            href={`/productos/${slug}`}
            className="line-clamp-2 min-h-[2.9em] after:absolute after:inset-0 after:rounded-card after:content-['']"
          >
            {nombre}
          </Link>
        </h3>

        {/*
          Precio a la izquierda, colores a la derecha, en la misma línea (§6.1).
          `items-end` y no `items-center`: el precio tiene dos tamaños de texto
          y alinear por el centro deja los puntos flotando alto.
        */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <Precio
            precio={producto.precio}
            descuento={producto.descuento}
            precioFinal={producto.precioFinal}
          />
          <PuntosDeColor colores={colores} />
        </div>
      </div>
    </article>
  );
}

/**
 * Los colores en que viene el producto, como puntos (§6.1).
 *
 * **No son seleccionables acá.** Elegir color es de la ficha (§6.5): en la
 * grilla son un dato —«esto viene en tres colores»— y hacerlos clicables
 * metería un segundo destino dentro de una tarjeta que ya es un enlace entero.
 *
 * Se muestran hasta cuatro. Un producto con nueve colores llenaría media
 * tarjeta de puntos y empujaría el precio; el resto se resume en «+N», que
 * dice lo mismo en un tercio del espacio.
 */
function PuntosDeColor({ colores }: { colores: { nombre: string; hex: string }[] }) {
  if (colores.length === 0) return null;

  const MAXIMO = 4;
  const visibles = colores.slice(0, MAXIMO);
  const resto = colores.length - visibles.length;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/*
        Los puntos son decorativos y el texto oculto de abajo dice los nombres:
        marcar cada punto por separado haría que un lector de pantalla recite
        «negro, blanco, rojo» sin decir nunca de qué está hablando.
      */}
      {visibles.map((c) => (
        <span
          key={c.hex + c.nombre}
          // El borde importa en los claros: un punto blanco sobre superficie
          // blanca, sin contorno, no existe.
          className="size-3 rounded-full border border-border"
          style={{ backgroundColor: c.hex }}
          aria-hidden="true"
        />
      ))}
      {resto > 0 ? (
        <span
          className="text-caption text-ink-tertiary tabular-nums"
          aria-hidden="true"
        >
          +{resto}
        </span>
      ) : null}
      <span className="sr-only">
        {colores.length === 1
          ? `Color: ${colores[0].nombre.toLowerCase()}`
          : `Colores: ${colores.map((c) => c.nombre.toLowerCase()).join(", ")}`}
      </span>
    </div>
  );
}
