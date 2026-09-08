"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  Heart,
  Minus,
  Plus,
  Share2,
  ShoppingCart,
} from "lucide-react";

import { Galeria, comoDesplazar } from "@/components/shop/ficha/galeria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
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
 * **Lo que NO entra acá entra como nodo.** El nombre, la marca, el precio, la
 * descripción y el bloque de información son servidor y llegan por
 * `encabezado` e `informacion`: nada de eso depende del color, y meterlo
 * adentro mandaría al navegador el formateador de moneda —`decimal.js`
 * entero— y el parseador de Markdown para pintar cosas que ya venían
 * pintadas.
 *
 * **La galería queda pegada y la columna derecha desplaza** (§7.3, decisión
 * del 2026-09-08). La descripción, los datos y el recuadro de «cómo sigue»
 * pasaron a la columna derecha, así que esa columna es mucho más alta que la
 * foto; sin `sticky`, mirar la descripción es perder de vista el producto del
 * que habla.
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
      {/*
        `self-start` es lo que hace posible el `sticky`: en una grilla, un
        elemento estirado ya ocupa toda la altura de la fila y no tiene contra
        qué pegarse. El `top` son los 56px del encabezado fijo más aire.
      */}
      <div className="self-start lg:sticky lg:top-18">
        <Galeria
          imagenes={imagenes}
          indice={iImagen}
          alt={`${producto.nombre} ${producto.marca}`}
          color={variante?.colorNombre ?? null}
          pista={pista}
          onScroll={setImagen}
          onElegir={irALaImagen}
        />
      </div>

      <div className="flex min-w-0 flex-col">
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

        <AccionesSecundarias
          nombre={producto.nombre}
          marca={producto.marca}
          url={mensaje.url}
        />

        {informacion}
      </div>
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
 * El botón de WhatsApp, que es el único que hoy hace algo de punta a punta.
 *
 * El ícono va adelante del texto y NO es lo único que dice de qué se trata:
 * el rótulo lleva «por WhatsApp» con todas las letras, así que el logo es
 * reconocimiento y no información (§9). Va en `currentColor` por §11 — ver el
 * comentario de `IconoWhatsApp`.
 */
function BotonDeWhatsApp({
  href,
  variante,
  children,
}: {
  href: string;
  variante: "brand" | "secondary";
  children: ReactNode;
}) {
  return (
    <Button asChild size="lg" variant={variante} className="w-full">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <IconoWhatsApp className="size-4" />
        {children}
      </a>
    </Button>
  );
}

/**
 * Con stock: cantidad, carrito y WhatsApp.
 *
 * **«Agregá al carrito» va deshabilitado y ya no lleva su explicación a la
 * vista** (decisión del 2026-09-08). §8 pide que todo estado deshabilitado
 * diga por qué, y acá el motivo pasó a ser solo para lectores de pantalla:
 * el botón es andamio para ver la composición terminada de §7.3 mientras
 * llega F5.5, y el renglón «el carrito todavía no está disponible» era, en la
 * pantalla, más grande que la falta que explicaba. Cuando F5.5 lo encienda,
 * la explicación desaparece con él.
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
        <p id="carrito-pendiente" className="sr-only">
          El carrito todavía no está disponible. Se puede comprar por WhatsApp.
        </p>

        {whatsapp ? (
          <BotonDeWhatsApp
            variante="secondary"
            href={enlaceDeWhatsApp(
              whatsapp,
              mensajeDeCompra(mensaje, cantidad, precioUnitario),
            )}
          >
            Comprá ya por WhatsApp
          </BotonDeWhatsApp>
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
        La etiqueta de estado de §6.4: píldora de tinte, color semántico y
        SIEMPRE con texto.
      */}
      <div>
        <Badge tone="danger">
          <Ban aria-hidden />
          Sin stock{color ? ` en ${color.toLowerCase()}` : ""}
        </Badge>
      </div>

      {whatsapp ? (
        <div className="flex flex-col gap-2">
          <BotonDeWhatsApp
            variante="brand"
            href={enlaceDeWhatsApp(whatsapp, mensajeDeDisponibilidad(mensaje))}
          >
            Preguntá si va a haber
          </BotonDeWhatsApp>
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
        <BotonDeWhatsApp
          variante="brand"
          href={enlaceDeWhatsApp(whatsapp, mensajeDeDisponibilidad(mensaje))}
        >
          Consultá por WhatsApp
        </BotonDeWhatsApp>
      ) : null}
    </div>
  );
}

// ── Guardar y compartir (§7.3) ──────────────────────────────────────────

/**
 * Los dos secundarios, uno al lado del otro debajo de las acciones de compra.
 *
 * **El corazón se mudó acá desde arriba de la foto** (decisión del
 * 2026-09-08). En la TARJETA sigue arriba a la derecha de la imagen, que es
 * donde §6.1 lo puso y donde se lo busca en una grilla; en la ficha hay lugar
 * para que diga «Guardar» con todas las letras, y un ícono solo sobre la foto
 * es la única señal que un lector de pantalla no puede aprovechar sin
 * etiqueta. Es un caso donde la misma acción se dibuja distinto en dos
 * pantallas a propósito, y está anotado en §14.
 *
 * **Guardar está apagado y Compartir anda.** No es una inconsistencia: los
 * favoritos son de F5.4 y necesitan cuenta, mientras que compartir no
 * necesita servidor —es `navigator.share` o el portapapeles—. Dibujar los dos
 * apagados habría escondido el único de los dos que ya se puede probar.
 */
function AccionesSecundarias({
  nombre,
  marca,
  url,
}: {
  nombre: string;
  marca: string;
  url: string;
}) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "sin-copiar">(
    "listo",
  );

  async function compartir() {
    const datos = { title: `${nombre} — ${marca}`, url };

    // La hoja nativa del sistema si existe —es la del teléfono, y la que
    // ofrece WhatsApp de primera—. `AbortError` es que la persona la cerró:
    // no es un fallo y no debe caer al portapapeles, que sería copiar algo
    // que decidió no compartir.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(datos);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      window.setTimeout(() => setEstado("listo"), 2000);
    } catch {
      /*
       * **El fallo se DICE, no se traga**, y esta rama pasa de verdad: el
       * portapapeles necesita contexto seguro, y `next.config.ts` habilita a
       * propósito abrir la tienda por IP de la LAN para probarla desde el
       * teléfono. Ahí `navigator.clipboard` directamente no existe. Sin este
       * aviso, el botón se aprieta y no pasa nada — que es la peor forma de
       * fallar, porque parece que el sitio se colgó.
       */
      setEstado("sin-copiar");
      window.setTimeout(() => setEstado("listo"), 4000);
    }
  }

  const copiado = estado === "copiado";

  return (
    <div className="pt-4">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          disabled
          aria-describedby="favoritos-pendiente"
          className="flex-1"
        >
          <Heart aria-hidden />
          Guardar
        </Button>
        <p id="favoritos-pendiente" className="sr-only">
          Los favoritos llegan cuando estén las cuentas.
        </p>

        <Button
          variant="secondary"
          size="md"
          onClick={compartir}
          className="flex-1"
        >
          {copiado ? <Check aria-hidden /> : <Share2 aria-hidden />}
          {copiado ? "¡Copiado!" : "Compartir"}
        </Button>
      </div>

      {estado === "sin-copiar" ? (
        <p className="pt-2 text-caption text-ink-secondary">
          No pudimos copiarlo. El enlace está en la barra de direcciones.
        </p>
      ) : null}

      {/*
        El cambio de rótulo lo anuncia una región viva y no el botón: cambiar
        el nombre accesible de un control que acaba de recibir el foco hace
        que el lector lo lea de nuevo y suene como si hubiera aparecido otro
        botón.
      */}
      <p aria-live="polite" className="sr-only">
        {copiado ? "Enlace copiado al portapapeles" : ""}
      </p>
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
    // la tienda (§6.6), y cada flecha llega al mínimo táctil de §9.
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
