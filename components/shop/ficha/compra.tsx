"use client";

import Image from "next/image";
import { useId, useRef, useState, type ReactNode } from "react";
import { Ban, Check, Expand, Minus, Plus, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  enlaceDeWhatsApp,
  mensajeDeCompra,
  mensajeDeDisponibilidad,
  type ProductoParaMensaje,
} from "@/lib/whatsapp";
import type { VarianteDeFicha } from "@/modules/catalog/products/ficha";

/**
 * La mitad viva de la ficha — F3.5, RF-03, DESIGN-REFERENCE §6.5, §6.8, §7.3.
 *
 * **Es una sola isla y no dos porque el color manda sobre todo lo demás.**
 * Cambiar de color cambia las imágenes, el stock, el tope del selector de
 * cantidad y el mensaje de WhatsApp. Partirla en «galería» y «acciones»
 * obligaría a levantar el estado a un tercer componente que igual tendría
 * que ser cliente, y serían tres archivos para una sola decisión.
 *
 * **Lo que NO entra acá entra como nodo.** El nombre, la marca, el precio y
 * el bloque de información son servidor y llegan por `encabezado` e
 * `informacion`: nada de eso depende del color, y meterlo adentro mandaría
 * al navegador el formateador de moneda —`decimal.js` entero— para pintar un
 * número que ya venía pintado. Es la misma decisión que `accionFavorito` en
 * la tarjeta.
 *
 * **`import type` y no `import`**: `modules/catalog/products/ficha` es
 * `server-only`. El tipo se borra al compilar, así que el módulo nunca entra
 * al paquete del navegador.
 */

export type ProductoEnFicha = {
  nombre: string;
  marca: string;
  /** Absoluta y sin consulta: el `?color=` lo agrega el enlace de WhatsApp. */
  url: string;
  /** Ya formateado por el servidor (§7.1, RN-02). */
  precioFinalFormateado: string;
};

type Props = {
  producto: ProductoEnFicha;
  variantes: VarianteDeFicha[];
  /** Índice de la variante que pide el `?color=` de la dirección. */
  inicial: number;
  /**
   * `null` mientras la vendedora no haya guardado la configuración (RF-20).
   * Sin número no se dibuja ningún botón de WhatsApp: `wa.me/` sin destino
   * abre la aplicación en la nada y parece que falló el sitio.
   */
  whatsapp: string | null;
  encabezado: ReactNode;
  informacion: ReactNode;
};

/**
 * §8 pide que TODO movimiento se apague bajo `prefers-reduced-motion`, y la
 * regla global de `globals.css` no alcanza acá: apaga `scroll-behavior`, que
 * es la propiedad de CSS, y no el `behavior: "smooth"` que se pasa por
 * JavaScript. Sin esto, mover la galería con las miniaturas seguía siendo un
 * desplazamiento animado para quien pidió que no lo fuera.
 */
function comoDesplazar(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}

export function Compra({
  producto,
  variantes,
  inicial,
  whatsapp,
  encabezado,
  informacion,
}: Props) {
  const [iVariante, setVariante] = useState(inicial);
  const [iImagen, setImagen] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [ampliada, setAmpliada] = useState(false);
  const pista = useRef<HTMLUListElement>(null);

  const variante = variantes[iVariante];
  const imagenes = variante?.imagenes ?? [];

  // Derivados, no estado: RF-24 permite stock NEGATIVO —una venta cargada
  // sobre unidades que el sistema no tenía— y eso es una discrepancia de la
  // vendedora, no un número que el comprador tenga que ver.
  const disponible = Math.max(0, variante?.disponible ?? 0);
  const sinStock = disponible === 0;

  // La cantidad se corrige AL LEERLA y no con un efecto: al pasar de un color
  // con 10 unidades a uno con 2, un efecto pintaría una vez con el 10 puesto
  // sobre un stock de 2 y lo corregiría en el siguiente cuadro.
  const cantidadValida = Math.min(Math.max(1, cantidad), Math.max(1, disponible));

  const mensaje = {
    nombre: producto.nombre,
    marca: producto.marca,
    color: variante?.colorNombre ?? null,
    url: variante?.colorSlug
      ? `${producto.url}?color=${variante.colorSlug}`
      : producto.url,
  };

  /**
   * El color se refleja en la dirección con `history.replaceState` y no con
   * una navegación: RF-03 pide que cambie «sin recargar la página», y una
   * navegación —aunque sea blanda— vuelve al servidor a buscar lo que ya
   * está en memoria y se lleva puesta la transición de 150ms de la galería.
   *
   * `replaceState` y no `pushState`: con `pushState`, mirar tres colores deja
   * tres entradas en el historial y el botón atrás recorre colores en vez de
   * volver al catálogo, que es de donde se llegó.
   */
  function elegirColor(i: number) {
    setVariante(i);
    // Al primer plano del color nuevo: seguir en la cuarta foto de un color
    // que tenía cinco, en uno que tiene dos, es quedarse en ninguna.
    setImagen(0);
    pista.current?.scrollTo({ left: 0, behavior: "instant" });

    const url = new URL(window.location.href);
    const slug = variantes[i]?.colorSlug;
    if (slug) url.searchParams.set("color", slug);
    else url.searchParams.delete("color");
    window.history.replaceState(null, "", url);
  }

  function irALaImagen(i: number) {
    setImagen(i);
    const track = pista.current;
    if (track) {
      track.scrollTo({ left: i * track.clientWidth, behavior: comoDesplazar() });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      <Galeria
        imagenes={imagenes}
        indice={iImagen}
        alt={`${producto.nombre} ${producto.marca}`}
        color={variante?.colorNombre ?? null}
        pista={pista}
        onScroll={setImagen}
        onElegir={irALaImagen}
        onAmpliar={() => setAmpliada(true)}
      />

      <div className="flex flex-col">
        {encabezado}

        {variantes.length > 0 ? (
          <SelectorDeColor
            variantes={variantes}
            elegida={iVariante}
            onElegir={elegirColor}
          />
        ) : null}

        <div className="pt-6">
          {variantes.length === 0 ? (
            /*
             * No es «sin stock»: es un producto que todavía no tiene ningún
             * color cargado. Existe de verdad —F2.4 da de alta en dos pasos,
             * y RN-05 lo muestra igual porque está activo— y decirle «sin
             * stock» sería contar una unidad que nunca hubo.
             */
            <TodaviaNo whatsapp={whatsapp} mensaje={mensaje} />
          ) : sinStock ? (
            <SinStock
              color={variante?.colorNombre ?? null}
              whatsapp={whatsapp}
              mensaje={mensaje}
            />
          ) : (
            <ConStock
              disponible={disponible}
              cantidad={cantidadValida}
              onCantidad={setCantidad}
              whatsapp={whatsapp}
              mensaje={mensaje}
              precioUnitario={producto.precioFinalFormateado}
            />
          )}
        </div>

        {informacion}
      </div>

      {/*
        La ampliación es de ESCRITORIO (§6.8). En un teléfono la foto ya ocupa
        el ancho de la pantalla y el navegador tiene su propio acercamiento con
        los dedos: un modal ahí es una capa más para cerrar, no una ayuda.
      */}
      {imagenes.length > 0 ? (
        <Dialog open={ampliada} onOpenChange={setAmpliada}>
          <DialogContent className="max-w-4xl p-3 sm:p-4">
            <DialogTitle className="sr-only">
              {producto.nombre} — imagen {iImagen + 1} de {imagenes.length}
            </DialogTitle>
            <div className="relative aspect-square w-full overflow-hidden rounded-image bg-surface">
              <Image
                src={imagenes[Math.min(iImagen, imagenes.length - 1)].grande}
                alt={
                  imagenes[Math.min(iImagen, imagenes.length - 1)].alt ??
                  `${producto.nombre} ${producto.marca}`
                }
                fill
                sizes="(min-width: 896px) 896px, 100vw"
                className="object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

// ── Galería (§6.8) ──────────────────────────────────────────────────────

/**
 * Una sola pista horizontal con scroll de encastre, y dos formas de moverla.
 *
 * En el teléfono se desliza con el dedo y los puntos siguen a la pista; en
 * escritorio la mueven las miniaturas. Es la misma estructura para los dos
 * (§6.8 describe dos comportamientos, no dos galerías): con dos, el índice
 * de la foto que se está viendo viviría en dos lugares y un día dirían
 * cosas distintas.
 *
 * El deslizamiento lo hace CSS —`snap-x snap-mandatory`—, no JavaScript. Lo
 * único que hace el `onScroll` es enterarse de dónde quedó.
 */
function Galeria({
  imagenes,
  indice,
  alt,
  color,
  pista,
  onScroll,
  onElegir,
  onAmpliar,
}: {
  imagenes: VarianteDeFicha["imagenes"];
  indice: number;
  alt: string;
  color: string | null;
  pista: React.RefObject<HTMLUListElement | null>;
  onScroll: (i: number) => void;
  onElegir: (i: number) => void;
  onAmpliar: () => void;
}) {
  const actual = Math.min(indice, Math.max(0, imagenes.length - 1));

  if (imagenes.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-card bg-surface shadow-md">
        <p className="text-body-sm text-ink-tertiary">
          Todavía no cargamos las fotos de este producto.
        </p>
      </div>
    );
  }

  // §9: «producto, marca y color». Sin el color, dos galerías del mismo
  // producto se anuncian idénticas.
  const descripcion = color ? `${alt}, ${color.toLowerCase()}` : alt;

  return (
    // `self-start`: en la grilla de dos columnas, la de la derecha es más
    // alta y estiraba a esta. Con la galería estirada, el botón «Ampliar»
    // —que se posiciona con `inset-0`— quedaba flotando debajo de la foto,
    // sobre el fondo de la página.
    <div className="flex flex-col gap-3 self-start md:flex-row md:gap-4">
      <div className="relative min-w-0 flex-1">
        <ul
          ref={pista}
          // En el teléfono NO hay miniaturas y las que se ven son un adorno
          // (`aria-hidden`), así que la pista es la única forma de llegar a
          // la segunda foto. Con `tabIndex` es una región desplazable con el
          // teclado y con nombre, en vez de depender de que el navegador
          // decida por su cuenta hacerla enfocable.
          tabIndex={0}
          aria-label={`Fotos de ${descripcion}`}
          // `overscroll-x-contain`: sin esto, llegar al final de la tira en un
          // teléfono empieza a arrastrar la página hacia atrás.
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-surface shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== indice) onScroll(i);
          }}
        >
          {imagenes.map((img, i) => (
            <li key={img.grande} className="w-full shrink-0 snap-center">
              {/*
                `contain` y no `cover` (§6.8): los periféricos vienen
                fotografiados sobre fondo blanco, y recortarlos los mutila.
                El aspecto se reserva con CSS para que la página no salte
                cuando llega la foto.
              */}
              <div className="relative aspect-square">
                <Image
                  src={img.grande}
                  alt={img.alt ?? `${descripcion} (${i + 1} de ${imagenes.length})`}
                  fill
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  // La primera es el LCP de esta pantalla: es lo más grande
                  // que hay arriba del pliegue.
                  priority={i === 0}
                  className="object-contain p-4"
                />
              </div>
            </li>
          ))}
        </ul>

        {/*
          Cubre la pista entera y existe solo en escritorio. Es un botón y no
          un `onClick` sobre la imagen: así entra en el recorrido de teclado y
          dice qué hace.
        */}
        <button
          type="button"
          onClick={onAmpliar}
          className="group absolute inset-0 hidden rounded-card md:block"
        >
          <span className="sr-only">Ampliar la foto</span>
          {/*
            `group-hover` y no `hover`: el ícono ocupa una esquina y el botón
            cubre la foto entera, así que con `hover` propio solo se encendía
            al pasar por encima de esos 36px.
          */}
          <span
            aria-hidden
            className="absolute right-4 bottom-4 flex size-9 items-center justify-center rounded-pill bg-surface/92 text-ink-secondary shadow-md transition-colors duration-150 group-hover:text-ink"
          >
            <Expand className="size-4" />
          </span>
        </button>

        {/* Los puntos son del teléfono; en escritorio mandan las miniaturas. */}
        {imagenes.length > 1 ? (
          <ul
            aria-hidden
            className="flex justify-center gap-1.5 pt-3 md:hidden"
          >
            {imagenes.map((img, i) => (
              <li
                key={img.grande}
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-150",
                  i === actual ? "bg-brand" : "bg-border-strong",
                )}
              />
            ))}
          </ul>
        ) : null}
      </div>

      {/* La tira va DESPUÉS en el DOM y a la derecha en pantalla (§6.8): el
          recorrido de teclado llega primero a la foto y después a las
          miniaturas, que es el orden en que se mira. */}
      {imagenes.length > 1 ? (
        <ul className="hidden shrink-0 flex-col gap-2 md:flex">
          {imagenes.map((img, i) => (
            <li key={img.grande}>
              <button
                type="button"
                onClick={() => onElegir(i)}
                aria-current={i === actual ? "true" : undefined}
                className={cn(
                  // El borde no es decorativo: los periféricos vienen
                  // fotografiados sobre blanco, y una miniatura blanca sobre
                  // una superficie blanca no se ve. Es el mismo motivo por el
                  // que las muestras de color lo llevan (§6.5).
                  "relative block size-16 overflow-hidden rounded-panel-image",
                  "border border-border bg-surface",
                  "transition-shadow duration-150",
                  i === actual
                    ? "ring-2 ring-brand ring-offset-2 ring-offset-canvas"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={img.miniatura}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
                <span className="sr-only">Ver la foto {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── Selector de color (§6.5) ────────────────────────────────────────────

/**
 * Muestras circulares, con el nombre del color SIEMPRE a la vista: §9 prohíbe
 * que el color sea la única forma de identificar una opción, y «gris grafito»
 * y «negro» son dos puntos casi iguales.
 *
 * **Un color sin stock SÍ se puede elegir**, y §6.5 decía lo contrario hasta
 * el 2026-09-08. El motivo del cambio es que ahora hay algo que hacer ahí:
 * elegir el color agotado es lo que da el mensaje de WhatsApp para preguntar
 * si va a haber (RF-03). Con el color bloqueado, ese estado no se alcanzaba
 * desde ninguna parte de la pantalla.
 *
 * Son `<input type="radio">` de verdad, escondidos: el recorrido con flechas,
 * el anuncio de «2 de 4» y el agrupado por nombre salen del navegador. Con
 * botones habría que reimplementar los tres y uno se olvida siempre.
 */
function SelectorDeColor({
  variantes,
  elegida,
  onElegir,
}: {
  variantes: VarianteDeFicha[];
  elegida: number;
  onElegir: (i: number) => void;
}) {
  const actual = variantes[elegida];

  // Un producto de un solo color sin nombre no tiene nada que elegir: el
  // selector sería una muestra sola, marcada, que no hace nada.
  if (variantes.length === 1 && !actual?.colorNombre) return null;

  return (
    // MARGEN y no relleno, y esto se midió: un `<legend>` se pinta sobre el
    // borde del `<fieldset>` e ignora su `padding-top`. Con `pt-8` la
    // separación real entre el precio y el «Color:» era CERO —el relleno solo
    // empujaba las muestras— y el rótulo se leía como una aclaración del
    // precio. §3.4: agrupar apretado, separar generoso.
    <fieldset className="mt-8">
      <legend className="text-body-sm text-ink-secondary">
        Color:{" "}
        <span className="font-medium text-ink">
          {actual?.colorNombre ?? "único"}
        </span>
      </legend>

      {/*
        La muestra mide 32px (§6.5) y el área táctil 44 (§9): el relleno de
        6px de cada `label` es lo que las concilia. Sin él son 32px de blanco
        objetivo en un teléfono, que es donde se elige el color equivocado.
        El `-ml-1.5` devuelve la primera muestra al margen del texto, que si
        no queda desalineada del «Color:» de arriba.
      */}
      <div className="-ml-1.5 flex flex-wrap gap-1 pt-2">
        {variantes.map((v, i) => {
          const agotado = v.disponible <= 0;
          return (
            <label
              key={v.colorSlug ?? i}
              className="relative cursor-pointer p-1.5"
              title={
                agotado ? `${v.colorNombre ?? "Único"} — sin stock` : undefined
              }
            >
              <input
                type="radio"
                name="color"
                className="peer sr-only"
                checked={i === elegida}
                onChange={() => onElegir(i)}
              />
              {/*
                DOS capas, y el 40% de §6.5 va SOLO en la de adentro. Con la
                opacidad sobre la muestra entera, el anillo burdeos del color
                elegido se destiñe con ella: un producto agotado en su único
                color se veía sin marcar. Es exactamente el caso más común.
              */}
              <span
                className={cn(
                  "block rounded-full transition-shadow duration-150",
                  "peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-checked:ring-offset-canvas",
                  "peer-focus-visible:shadow-focus",
                )}
              >
                <span
                  className={cn(
                    // El borde importa en los claros: un punto blanco sobre
                    // superficie blanca, sin contorno, no existe.
                    "block size-8 rounded-full border border-border",
                    agotado ? "opacity-40" : "",
                  )}
                  style={{ backgroundColor: v.colorHex ?? "transparent" }}
                />
              </span>
              {/*
                La barra diagonal de §6.5. Va sobre la muestra y no la
                reemplaza: el color se sigue viendo, que es lo que hace que
                alguien lo elija para preguntar si va a haber.
              */}
              {agotado ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-1/2 h-px w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink-secondary"
                />
              ) : null}
              <span className="sr-only">
                {v.colorNombre ?? "Color único"}
                {agotado ? ", sin stock" : ""}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ── Las acciones ────────────────────────────────────────────────────────

/**
 * Con stock: cantidad, carrito y WhatsApp.
 *
 * **«Agregá al carrito» va deshabilitado y con el motivo al lado**, que es lo
 * que §8 exige de todo estado deshabilitado. El carrito es F5.5 y todavía no
 * existe; se dibuja igual, por decisión del 2026-09-08, para que la ficha
 * muestre desde ya la composición de §7.3. Cuando llegue F5.5 se enciende y
 * WhatsApp baja a secundario, que es donde §7.3 lo pone.
 */
function ConStock({
  disponible,
  cantidad,
  onCantidad,
  whatsapp,
  mensaje,
  precioUnitario,
}: {
  disponible: number;
  cantidad: number;
  onCantidad: (n: number) => void;
  whatsapp: string | null;
  mensaje: ProductoParaMensaje;
  precioUnitario: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Cantidad valor={cantidad} maximo={disponible} onCambio={onCantidad} />
        {/*
          Sin color: no es una etiqueta de estado sino un dato, y §11 pide que
          la interfaz quede acromática y que el color lo ponga la foto. El
          verde acá sería tranquilizar de un riesgo que nadie corrió — casi
          todos los productos tienen stock.
        */}
        <p className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
          <Check aria-hidden className="size-4" />
          {disponible === 1 ? "Queda 1" : `${disponible} disponibles`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          variant="brand"
          disabled
          aria-describedby="carrito-pendiente"
          className="w-full"
        >
          <ShoppingCart aria-hidden />
          Agregá al carrito
        </Button>
        <p id="carrito-pendiente" className="text-caption text-ink-secondary">
          El carrito todavía no está disponible. Mientras tanto, escribinos y
          te lo reservamos.
        </p>

        {whatsapp ? (
          <Button asChild size="lg" variant="secondary" className="mt-2 w-full">
            <a
              href={enlaceDeWhatsApp(
                whatsapp,
                mensajeDeCompra(mensaje, cantidad, precioUnitario),
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              Comprá por WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sin stock — RF-03, DR §7.3.
 *
 * Tres cosas a propósito: **lo dice con palabras** y no solo con un botón
 * apagado —un botón gris sin explicación se lee como una falla del sitio—;
 * la consulta por WhatsApp es el botón **principal**, porque es la única
 * acción que le queda a quien llegó hasta acá; y la aclaración de abajo es la
 * promesa que NO hacemos: «preguntá si va a haber» suena a que el sitio va a
 * avisar, y no hay ningún aviso.
 */
function SinStock({
  color,
  whatsapp,
  mensaje,
}: {
  color: string | null;
  whatsapp: string | null;
  mensaje: ProductoParaMensaje;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        La etiqueta de estado de §6.4, que ya existe: píldora de tinte, color
        semántico y SIEMPRE con texto. Estaba dibujada a mano con un punto y
        un renglón, que es la misma cosa reimplementada — y la que el día que
        cambie el sistema se queda vieja sola.
      */}
      <div>
        <Badge tone="danger">
          <Ban aria-hidden />
          Sin stock{color ? ` en ${color.toLowerCase()}` : ""}
        </Badge>
      </div>

      {whatsapp ? (
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" variant="brand" className="w-full">
            <a
              href={enlaceDeWhatsApp(whatsapp, mensajeDeDisponibilidad(mensaje))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preguntá si va a haber
            </a>
          </Button>
          <p className="text-caption text-ink-secondary">
            Te contestamos por WhatsApp. No lo reservamos ni te avisamos solos.
          </p>
        </div>
      ) : (
        <p className="text-body-sm text-ink-secondary">
          Probá con otro color, o volvé más adelante.
        </p>
      )}
    </div>
  );
}

/**
 * Un producto activo sin ninguna variante activa (RF-16, RN-05).
 *
 * Comparte el mensaje de disponibilidad con el estado sin stock: desde
 * afuera la pregunta es la misma —«¿esto se puede conseguir?»— y dos
 * mensajes casi iguales le harían a la vendedora leer dos veces para
 * entender qué le están preguntando.
 */
function TodaviaNo({
  whatsapp,
  mensaje,
}: {
  whatsapp: string | null;
  mensaje: ProductoParaMensaje;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body font-medium text-ink">
        Todavía no está a la venta
      </p>
      <p className="text-body-sm text-ink-secondary">
        Lo estamos cargando. Si te interesa, escribinos y te contamos cuándo
        entra.
      </p>
      {whatsapp ? (
        <Button asChild size="lg" variant="brand" className="w-full">
          <a
            href={enlaceDeWhatsApp(whatsapp, mensajeDeDisponibilidad(mensaje))}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consultá por WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Cantidad, con tope en el stock de la variante (RF-03).
 *
 * El campo es `type="number"` y no dos botones sobre un número pintado:
 * llevar de 1 a 12 a fuerza de clics es once clics, y escribirlo es uno. Las
 * flechas quedan igual porque de 1 a 2 el clic es más rápido que el teclado.
 */
function Cantidad({
  valor,
  maximo,
  onCambio,
}: {
  valor: number;
  maximo: number;
  onCambio: (n: number) => void;
}) {
  // `useId` y no un `id` escrito: hoy hay un solo selector por pantalla, y el
  // día que el bloque de recomendados (F8.2) traiga otro, dos campos con el
  // mismo `id` dejan a la etiqueta apuntando al primero.
  const id = useId();
  const acotar = (n: number) => Math.min(Math.max(1, n), maximo);

  return (
    // `p-0.5` con botones de 44: 48px de alto, que es la altura de campo de
    // la tienda (§6.6), y cada flecha llega al mínimo táctil de §9. Con los
    // 36px que tenía, las dos flechas quedaban por debajo.
    <div className="flex items-center gap-0.5 rounded-pill border border-border bg-surface p-0.5">
      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor <= 1}
        onClick={() => onCambio(acotar(valor - 1))}
      >
        <Minus aria-hidden />
        <span className="sr-only">Quitar uno</span>
      </Button>

      <label className="sr-only" htmlFor={id}>
        Cantidad
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={maximo}
        value={valor}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          // Un campo vacío no vuelve a 1 de un salto mientras se escribe: se
          // ignora, y el valor válido sigue en pantalla.
          if (!Number.isNaN(n)) onCambio(acotar(n));
        }}
        className="w-10 bg-transparent text-center text-body font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor >= maximo}
        onClick={() => onCambio(acotar(valor + 1))}
      >
        <Plus aria-hidden />
        <span className="sr-only">Agregar uno</span>
      </Button>
    </div>
  );
}
