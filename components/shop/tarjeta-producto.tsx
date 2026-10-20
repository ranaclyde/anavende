import Image from "next/image";
import type { ReactNode } from "react";

import { EnlaceDeTarjeta } from "@/components/shop/foto-viajera";
import { Precio } from "@/components/shop/precio";
import { EsferaDeColor } from "@/components/ui/esfera-de-color";
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
  /** Lo que guarda el corazón (F5.4): el favorito es del producto. */
  id: string;
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
  colores?: { nombre: string; hex: string; hex2?: string | null }[];
  /** `stock_total − reserved_stock` sumado sobre las variantes (§8.1). */
  disponible: number;
};

type Props = {
  producto: ProductoEnTarjeta;
  /**
   * El corazón de RF-10 (F5.4, `components/shop/favorito.tsx`). Se recibe
   * como nodo y no como `onToggle` para que la tarjeta pueda seguir siendo
   * servidor: la isla de cliente la arma quien la pasa. Sin esto, no se dibuja
   * nada — un corazón que no hace nada es peor que ningún corazón.
   *
   * La tarjeta solo pone el lugar: arriba a la derecha de la imagen y SIEMPRE
   * a la vista (DR §6.1). Que esté FUERA del ancla lo resuelve acá abajo el
   * enlace estirado, y no es negociable: un `<a>` que envolviera la tarjeta se
   * llevaría el botón adentro.
   */
  accionFavorito?: ReactNode;
  /**
   * Un favorito que la vendedora desactivó después (RF-10, F5.4). Se dibuja
   * con la píldora «No disponible» y **sin enlace**: la ficha de un producto
   * inactivo es un 404 (RN-05). El corazón sigue, porque es la forma de
   * sacarlo de la lista.
   */
  noDisponible?: boolean;
  /**
   * Sin carga diferida: el navegador la trae en su turno y no espera a que se
   * acerque al pliegue. Es para la primera fila de una grilla, que está arriba
   * del pliegue y en tableta y escritorio suele ser el LCP; diferida, llegaba
   * tarde.
   *
   * **Sin prioridad alta** (F10.4): esa es solo para la foto principal de la
   * ficha (TS §20). Hasta F10.4 el catálogo usaba `priority`; no hace falta,
   * porque React ya precarga en el servidor toda imagen que no sea diferida
   * —hasta diez por página—, con prioridad normal.
   */
  inmediata?: boolean;
};

export function TarjetaProducto({
  producto,
  accionFavorito,
  noDisponible = false,
  inmediata,
}: Props) {
  const { slug, nombre, marca, imagenKey, color, disponible } = producto;
  const colores = producto.colores ?? [];
  const sinStock = !noDisponible && disponible <= 0;
  const pildora = noDisponible
    ? "No disponible"
    : sinStock
      ? "Sin stock"
      : null;

  // §9: «producto, marca y color». Sin el color, dos tarjetas de la misma
  // ficha se anuncian idénticas.
  const alt =
    [nombre, marca].join(" ") + (color ? `, ${color.toLowerCase()}` : "");

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
        // Sin enlace no hay a dónde ir, y elevarse al pasar prometería uno.
        noDisponible
          ? ""
          : "hover:shadow-lg motion-safe:hover:-translate-y-0.5",
        // Al apretarla, se hunde apenas (2026-10-20). Es la única respuesta
        // al toque en un teléfono, donde no hay hover, y sin ella no pasa nada
        // a la vista hasta que carga la ficha. Mira el enlace y no la tarjeta:
        // apretar el corazón no la tiene que hundir.
        noDisponible
          ? ""
          : "motion-safe:has-[[data-enlace-tarjeta]:active]:scale-[0.98]",
        // `translate` y `scale` y no `transform`: Tailwind 4 mueve con esas
        // dos propiedades, y con `transform` la subida no se animaba.
        "motion-safe:transition-[box-shadow,translate,scale]",
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
              loading={inmediata ? "eager" : undefined}
              // La que viaja a la ficha al tocar la tarjeta. El radio va
              // también en la foto porque viaja sola, sin el marco que la
              // recorta.
              data-foto-tarjeta
              className={cn(
                "rounded-image object-cover",
                "motion-safe:transition-transform motion-safe:duration-200",
                "motion-safe:group-hover:scale-[1.03]",
                // §6.1: la imagen baja a 55% cuando no hay stock. La píldora
                // de abajo es la que lo DICE — el color no alcanza (§9). Lo
                // que ya no se vende pierde además el color, como en el
                // carrito (F5.6).
                sinStock ? "opacity-55" : "",
                noDisponible ? "opacity-55 grayscale" : "",
              )}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-caption text-ink-secondary">Sin foto</span>
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
          {pildora ? (
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface/92 px-3 py-1.5 text-caption font-medium whitespace-nowrap text-ink shadow-md">
              {pildora}
            </p>
          ) : null}

          {/*
            Encima del enlace estirado, y a la vista SIEMPRE: revelarlo al pasar
            el mouse lo dejaría inalcanzable en un teléfono, donde no hay hover.
          */}
          {accionFavorito ? (
            <div className="absolute top-2 right-2 z-10">{accionFavorito}</div>
          ) : null}

          <CantidadDeColores colores={colores} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-1 pt-3 pb-1">
        {/*
          Sin versalitas, y pegada al nombre (2026-10-20, pedido tuyo): en
          mayúsculas y con aire propio se leía más importante que el nombre
          del producto. Queda en 12px, que es el piso (§3).
        */}
        <p className="-mb-1 text-caption text-ink-secondary">{marca}</p>

        <h3 className="text-body-sm font-medium text-ink">
          {/*
            ENLACE ESTIRADO. La tarjeta entera es clicable (§6.1) y el ancla
            vive acá adentro: envolver todo en un `<a>` metería el botón de
            favoritos DENTRO del enlace, que es HTML inválido y deja el corazón
            inalcanzable con teclado. El pseudo-elemento cubre la tarjeta sin
            anidar nada.

            `line-clamp-2` y **sin alto reservado** (2026-10-20). Lo tuvo para
            que un nombre de una línea y otro de dos no dejaran los precios de
            la fila a distinta altura; ahora eso lo resuelve el `mt-auto` del
            precio, que lo pega al fondo de la tarjeta, y la reserva solo
            dejaba un renglón en blanco bajo los nombres cortos.
          */}
          {noDisponible ? (
            <span className="line-clamp-2">{nombre}</span>
          ) : (
            // Al tocarla, la foto viaja a la ficha (`foto-viajera.tsx`).
            <EnlaceDeTarjeta
              href={`/productos/${slug}`}
              slug={slug}
              className="line-clamp-2 after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {nombre}
            </EnlaceDeTarjeta>
          )}
        </h3>

        {/*
          Solo el precio, con el tachado arriba (2026-10-20). Hasta ese día
          compartía renglón con los puntos de color, y cuando no entraban
          juntos el precio se partía: el tachado subía en una tarjeta y no en
          la de al lado, y con cinco colores o en el carrusel del teléfono, se
          pisaban. Los colores pasaron a la foto (`CantidadDeColores`).
        */}
        <Precio
          precio={producto.precio}
          descuento={producto.descuento}
          precioFinal={producto.precioFinal}
          apilado
          className="mt-auto pt-1"
        />
      </div>
    </article>
  );
}

/**
 * Cuántos colores hay, sobre la foto — 2026-10-20, a la manera de Mercado
 * Libre.
 *
 * **Con un solo color no se muestra nada**: no hay nada que elegir, y la
 * foto ya lo muestra. Con dos o más, una pastilla abajo a la izquierda con
 * una ruedita y el número. **La ruedita es un arcoíris fijo, igual en
 * todas** (decisión tuya del 2026-10-20): su trabajo es decir «hay más de un
 * color», no cuáles. Partida en los colores reales, con diez se volvía una
 * mancha, y con negro y gris se perdía contra la pastilla oscura.
 *
 * Reemplaza a los puntos debajo del precio, que no tenían un ancho donde
 * entrar siempre: con cinco colores, o en el carrusel del teléfono, pisaban
 * el precio. Un número entra en cualquier tarjeta.
 *
 * Abajo a la izquierda porque arriba a la derecha está el corazón, y en el
 * centro la píldora de «Sin stock».
 */
function CantidadDeColores({
  colores,
}: {
  colores: { nombre: string; hex: string; hex2?: string | null }[];
}) {
  if (colores.length < 2) return null;

  return (
    <p className="absolute bottom-2 left-2 flex items-center gap-1 rounded-pill bg-ink/75 py-0.5 pr-2 pl-1 text-caption font-medium text-ink-inverse tabular-nums">
      <span
        aria-hidden
        className="block size-3.5 rounded-full border border-ink-inverse/60"
        style={{ background: RUEDA }}
      />
      <span aria-hidden>{colores.length}</span>
      <span className="sr-only">
        En {colores.length} colores:{" "}
        {colores.map((c) => c.nombre.toLowerCase()).join(", ")}
      </span>
    </p>
  );
}

/** El círculo cromático, el mismo en toda la tienda. */
const RUEDA =
  "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)";

/**
 * Los colores en que viene el producto, como puntos (§6.1). Desde el
 * 2026-10-20 los usa solo el renglón de «Favoritos»; la tarjeta muestra
 * `CantidadDeColores`.
 *
 * **No son seleccionables acá.** Elegir color es de la ficha (§6.5): en la
 * grilla son un dato —«esto viene en tres colores»— y hacerlos clicables
 * metería un segundo destino dentro de una tarjeta que ya es un enlace entero.
 *
 * Se muestran hasta cuatro. Un producto con nueve colores llenaría media
 * tarjeta de puntos y empujaría el precio; el resto se resume en «+N», que
 * dice lo mismo en un tercio del espacio.
 *
 * Se exporta para el renglón de «Favoritos» (F5.4): la lista dice lo mismo
 * que la tarjeta, con los mismos puntos.
 */
export function PuntosDeColor({
  colores,
}: {
  colores: { nombre: string; hex: string; hex2?: string | null }[];
}) {
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
        <EsferaDeColor
          key={c.hex + c.nombre}
          hex={c.hex}
          hex2={c.hex2}
          className="size-3"
        />
      ))}
      {resto > 0 ? (
        <span
          className="text-caption text-ink-secondary tabular-nums"
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
