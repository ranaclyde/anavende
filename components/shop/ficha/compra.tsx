"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Ban, Check, Share2, ShoppingCart } from "lucide-react";

import { Cantidad } from "@/components/shop/cantidad";
import {
  propsDePausa,
  useCuentaEnPausa,
} from "@/components/shop/cuenta-en-pausa";
import { BotonFavorito } from "@/components/shop/favorito";
import { Galeria, comoDesplazar } from "@/components/shop/ficha/galeria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EsferaDeColor } from "@/components/ui/esfera-de-color";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { cn } from "@/lib/utils";
import {
  whatsappLink,
  purchaseMessage,
  availabilityMessage,
  type ProductForMessage,
} from "@/lib/whatsapp";
import {
  agregarAlCarrito,
  recordarCompraPendiente,
  retomarCompraPendiente,
} from "@/modules/cart/actions";
import { TOPE_POR_ITEM } from "@/modules/cart/schemas";
import type { VarianteDeFicha } from "@/modules/catalog/products/ficha";

// Una sola isla porque el color cambia imágenes, stock, tope y mensaje de
// WhatsApp. Lo que no depende del color llega como nodo (`encabezado`,
// `informacion`): adentro mandaría al navegador `decimal.js` y el parseador
// de Markdown. `import type` porque `modules/catalog/products/ficha` es
// `server-only`.

export type ProductoEnFicha = {
  nombre: string;
  marca: string;
  /** Absoluta y sin consulta: el `?color=` lo agrega el enlace de WhatsApp. */
  url: string;
  /** Relativa y sin consulta: a dónde volver después de ingresar. */
  ruta: string;
  /** Ya formateado por el servidor, para no traer `decimal.js`. */
  precioFinalFormateado: string;
};

type Props = {
  producto: ProductoEnFicha;
  variantes: VarianteDeFicha[];
  /** Índice de la variante que pide el `?color=` de la dirección. */
  inicial: number;
  /**
   * Sin número no se dibuja ningún botón de WhatsApp: `wa.me/` sin destino
   * abre la aplicación en la nada y parece que falló el sitio.
   */
  whatsapp: string | null;
  /** Sin sesión no hay carrito, y el botón invita a ingresar. */
  conSesion: boolean;
  /**
   * Hay una compra anotada de antes de iniciar sesión. Cuál, vive en la
   * cookie del lado del servidor: la ficha solo sabe si hay que preguntar.
   */
  pendiente: boolean;
  /** El favorito es del producto, no del color elegido. */
  favorito: { productId: string; marcado: boolean };
  encabezado: ReactNode;
  informacion: ReactNode;
};

export function Compra({
  producto,
  variantes,
  inicial,
  whatsapp,
  conSesion,
  pendiente,
  favorito,
  encabezado,
  informacion,
}: Props) {
  // Con la baja pedida no se retoma: la acción la rechazaría.
  const enPausa = useCuentaEnPausa();
  const retomada = useRetomarPendiente(pendiente && !enPausa);
  const [iVariante, setVariante] = useState(inicial);
  const [iImagen, setImagen] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const pista = useRef<HTMLUListElement>(null);

  const variante = variantes[iVariante];
  const slug = producto.ruta.split("/")[2];
  const imagenes = variante?.imagenes ?? [];

  // El stock puede ser negativo (RF-24): el comprador no lo tiene que ver.
  const disponible = Math.max(0, variante?.disponible ?? 0);
  const sinStock = disponible === 0;

  const tope = Math.min(disponible, TOPE_POR_ITEM);

  // Se corrige al leerla y no con un efecto, que pintaría un cuadro con una
  // cantidad mayor al stock del color nuevo.
  const cantidadValida = Math.min(Math.max(1, cantidad), Math.max(1, tope));

  const mensaje = {
    nombre: producto.nombre,
    marca: producto.marca,
    color: variante?.colorNombre ?? null,
    url: variante?.colorSlug
      ? `${producto.url}?color=${variante.colorSlug}`
      : producto.url,
  };

  const volver = variante?.colorSlug
    ? `${producto.ruta}?color=${variante.colorSlug}`
    : producto.ruta;

  /**
   * `history.replaceState` y no una navegación: aun blanda vuelve al servidor
   * y corta la transición de la galería. Y no `pushState`, para que atrás
   * vuelva al catálogo y no recorra colores.
   */
  function elegirColor(i: number) {
    setVariante(i);
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
      track.scrollTo({
        left: i * track.clientWidth,
        behavior: comoDesplazar(),
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
      {/*
        Sin `self-start` no hay `sticky`: estirado en la grilla, no tiene
        contra qué pegarse. El `top` es el encabezado fijo más aire.
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
          transicion={slug}
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
            // No es «sin stock»: es un producto activo sin ningún color cargado.
            <TodaviaNo whatsapp={whatsapp} mensaje={mensaje} />
          ) : sinStock ? (
            <SinStock
              color={variante?.colorNombre ?? null}
              whatsapp={whatsapp}
              mensaje={mensaje}
              // Por si se quedó sin stock mientras el comprador se registraba.
              aviso={<AvisoDelCarrito resultado={retomada.resultado} />}
            />
          ) : (
            <ConStock
              // Por color, para que el «Listo» no quede puesto al cambiar.
              key={variante.id}
              variantId={variante.id}
              conSesion={conSesion}
              retomada={retomada}
              volver={volver}
              disponible={disponible}
              tope={tope}
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
          favorito={favorito}
          conSesion={conSesion}
          volver={volver}
        />

        {informacion}
      </div>
    </div>
  );
}

type ResultadoDelCarrito =
  { ok: true; enElCarrito: number } | { ok: false; mensaje: string };

type Retomada = {
  enCurso: boolean;
  resultado: ResultadoDelCarrito | null;
  descartar: () => void;
};

/**
 * Retoma la compra anotada antes de ingresar. La acción no recibe qué agregar
 * a propósito: sale de la cookie del servidor, no del navegador.
 *
 * Vive en `Compra` y no en el botón porque el botón puede no estar (sin
 * stock), y el intento igual tiene que ocurrir y contarse.
 */
function useRetomarPendiente(pendiente: boolean): Retomada {
  const [enCurso, iniciar] = useTransition();
  const [resultado, setResultado] = useState<ResultadoDelCarrito | null>(null);
  const yaSePidio = useRef(false);

  useEffect(() => {
    if (!pendiente || yaSePidio.current) return;

    // Un `ref`: React monta dos veces en desarrollo, y dos llamadas leerían la
    // misma cookie antes de que la primera la borre, agregando el doble.
    yaSePidio.current = true;

    iniciar(async () => {
      const r = await retomarCompraPendiente({});

      if (!r.ok) {
        // Quien vuelve de ingresar no sabe que había algo esperando: primero
        // qué pasó, después por qué.
        setResultado({
          ok: false,
          mensaje: `Lo que habías elegido no se pudo agregar. ${r.message}`,
        });
        return;
      }

      // `retomado: false`: otra pestaña se lo llevó antes. No es una falla.
      if (r.data.retomado) {
        setResultado({ ok: true, enElCarrito: r.data.cantidad });
      }
    });
  }, [pendiente]);

  return { enCurso, resultado, descartar: () => setResultado(null) };
}

/**
 * La región viva existe siempre, vacía hasta que haya algo que decir: un
 * lector de pantalla no anuncia una región que aparece con el texto adentro.
 */
function AvisoDelCarrito({
  resultado,
}: {
  resultado: ResultadoDelCarrito | null;
}) {
  return (
    <>
      <div aria-live="polite">
        {resultado?.ok ? (
          <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-ink-secondary">
            <Check aria-hidden className="size-4" />
            {resultado.enElCarrito === 1
              ? "Listo, está en tu carrito."
              : `Listo, tenés ${resultado.enElCarrito} en tu carrito.`}
            <Link
              href="/carrito"
              className="rounded-pill font-medium text-ink underline underline-offset-4"
            >
              Ver carrito
            </Link>
          </p>
        ) : null}
      </div>

      {resultado && !resultado.ok ? (
        <p role="alert" className="text-body-sm text-danger">
          {resultado.mensaje}
        </p>
      ) : null}
    </>
  );
}

/**
 * Un color sin stock se puede elegir a propósito: es lo que da el mensaje de
 * WhatsApp para preguntar si va a haber. Son radios de verdad, escondidos:
 * las flechas y el anuncio de «2 de 4» salen del navegador.
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

  // Sin nada que elegir, el dato se dice igual: si no, no se sabe si hay
  // otros colores o si la ficha se olvidó de contarlo.
  if (variantes.length === 1 && !actual?.colorNombre) {
    return (
      <p className="mt-8 text-body-sm text-ink-secondary">
        Color: <span className="font-medium text-ink">Único</span>
      </p>
    );
  }

  return (
    // Margen y no relleno: el `<legend>` se pinta sobre el borde del
    // `<fieldset>` e ignora su `padding-top`.
    <fieldset
      className="mt-8"
      // Con un solo color no hay nada que elegir, y la guía no lo señala.
      data-ayuda={variantes.length > 1 ? "elegir-color" : undefined}
    >
      <legend className="text-body-sm text-ink-secondary">
        Color:{" "}
        <span className="font-medium text-ink">
          {actual?.colorNombre ?? "Único"}
        </span>
      </legend>

      {/*
        El `p-1.5` de cada `label` lleva la muestra de 32px al área táctil de
        44; el `-ml-1.5` la devuelve al margen del «Color:».
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
                Dos capas: la opacidad va solo en la de adentro, para que no
                destiña el anillo del color elegido.
              */}
              <span
                className={cn(
                  "block rounded-full transition-shadow duration-150",
                  "peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-checked:ring-offset-canvas",
                  "peer-focus-visible:shadow-focus",
                )}
              >
                {v.colorHex ? (
                  <EsferaDeColor
                    hex={v.colorHex}
                    hex2={v.colorHex2}
                    className={cn("size-8", agotado ? "opacity-40" : "")}
                  />
                ) : (
                  <span className="block size-8 rounded-full border border-border" />
                )}
              </span>
              {/* La barra va sobre la muestra: el color se sigue viendo. */}
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

function BotonDeWhatsApp({
  href,
  ayuda,
  children,
}: {
  href: string;
  /** El paso de la ayuda guiada que lo señala. */
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      size="lg"
      variant="whatsapp"
      className="w-full"
      data-ayuda={ayuda}
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <IconoWhatsApp className="size-4" />
        {children}
      </a>
    </Button>
  );
}

function ConStock({
  variantId,
  conSesion,
  retomada,
  volver,
  disponible,
  tope,
  cantidad,
  onCantidad,
  whatsapp,
  mensaje,
  precioUnitario,
}: {
  variantId: string;
  conSesion: boolean;
  retomada: Retomada;
  volver: string;
  disponible: number;
  tope: number;
  cantidad: number;
  onCantidad: (n: number) => void;
  whatsapp: string | null;
  mensaje: ProductForMessage;
  precioUnitario: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Cantidad valor={cantidad} maximo={tope} onCambio={onCantidad} />
        {/* Sin color a propósito: es un dato, no una etiqueta de estado. */}
        <p className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
          <Check aria-hidden className="size-4" />
          {disponible === 1 ? "Queda 1" : `${disponible} disponibles`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {conSesion ? (
          <AgregarAlCarrito
            variantId={variantId}
            cantidad={cantidad}
            retomada={retomada}
          />
        ) : (
          <IniciarSesionParaComprar
            variantId={variantId}
            cantidad={cantidad}
            volver={volver}
          />
        )}

        {/* Relleno: es la otra forma de comprar, no una acción de apoyo. */}
        {whatsapp ? (
          <BotonDeWhatsApp
            ayuda="comprar-whatsapp"
            href={whatsappLink(
              whatsapp,
              purchaseMessage(mensaje, cantidad, precioUnitario),
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
 * Un enlace y no un botón: lleva al ingreso, y anotar la compra es el efecto
 * de costado. La llamada no se espera a propósito: la navegación es blanda y
 * el pedido sigue viajando; si falla, se pierde la nota y no el ingreso.
 */
function IniciarSesionParaComprar({
  variantId,
  cantidad,
  volver,
}: {
  variantId: string;
  cantidad: number;
  volver: string;
}) {
  return (
    <Button
      asChild
      size="lg"
      variant="brand"
      className="w-full"
      data-ayuda="comprar-carrito"
    >
      <Link
        href={`/ingresar?volver=${encodeURIComponent(volver)}`}
        onClick={() => {
          void recordarCompraPendiente({ variantId, cantidad });
        }}
      >
        <ShoppingCart aria-hidden />
        Iniciá sesión para comprar
      </Link>
    </Button>
  );
}

/**
 * Un solo aviso, venga de donde venga: el de la compra retomada y el de un
 * agregado a mano ocupan el mismo lugar. Dos «Listo» apilados se leerían como
 * que se agregó dos veces.
 */
function AgregarAlCarrito({
  variantId,
  cantidad,
  retomada,
}: {
  variantId: string;
  cantidad: number;
  retomada: Retomada;
}) {
  const [enCurso, iniciar] = useTransition();
  const [propio, setPropio] = useState<ResultadoDelCarrito | null>(null);
  const pausa = propsDePausa(useCuentaEnPausa());

  function agregar() {
    setPropio(null);
    retomada.descartar();

    iniciar(async () => {
      const r = await agregarAlCarrito({ variantId, cantidad });
      setPropio(
        r.ok
          ? { ok: true, enElCarrito: r.data.cantidad }
          : { ok: false, mensaje: r.message },
      );
    });
  }

  return (
    <>
      <Button
        size="lg"
        variant="brand"
        className="w-full"
        data-ayuda="comprar-carrito"
        loading={enCurso || retomada.enCurso}
        loadingLabel={
          retomada.enCurso ? "Retomando tu compra" : "Agregando al carrito"
        }
        onClick={agregar}
        {...pausa}
      >
        <ShoppingCart aria-hidden />
        Agregá al carrito
      </Button>

      <AvisoDelCarrito resultado={propio ?? retomada.resultado} />
    </>
  );
}

function SinStock({
  color,
  whatsapp,
  mensaje,
  aviso,
}: {
  color: string | null;
  whatsapp: string | null;
  mensaje: ProductForMessage;
  aviso: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Siempre con texto, no solo el color. */}
      <div>
        <Badge tone="danger">
          <Ban aria-hidden />
          Sin stock{color ? ` en ${color.toLowerCase()}` : ""}
        </Badge>
      </div>

      {aviso}

      {whatsapp ? (
        <BotonDeWhatsApp
          href={whatsappLink(whatsapp, availabilityMessage(mensaje))}
        >
          Consultar disponibilidad
        </BotonDeWhatsApp>
      ) : (
        <p className="text-body-sm text-ink-secondary">
          Probá con otro color, o volvé más adelante.
        </p>
      )}
    </div>
  );
}

/** Un producto activo sin ninguna variante activa (RN-05). */
function TodaviaNo({
  whatsapp,
  mensaje,
}: {
  whatsapp: string | null;
  mensaje: ProductForMessage;
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
          href={whatsappLink(whatsapp, availabilityMessage(mensaje))}
        >
          Consultá por WhatsApp
        </BotonDeWhatsApp>
      ) : null}
    </div>
  );
}

function AccionesSecundarias({
  nombre,
  marca,
  url,
  favorito,
  conSesion,
  volver,
}: {
  nombre: string;
  marca: string;
  url: string;
  favorito: { productId: string; marcado: boolean };
  conSesion: boolean;
  volver: string;
}) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "sin-copiar">(
    "listo",
  );

  async function compartir() {
    const datos = { title: `${nombre} — ${marca}`, url };

    // `AbortError` es que la persona cerró la hoja: no cae al portapapeles,
    // que sería copiar algo que decidió no compartir.
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
      // Pasa de verdad: sin contexto seguro (la tienda por IP de la LAN) no
      // existe `navigator.clipboard`.
      setEstado("sin-copiar");
      window.setTimeout(() => setEstado("listo"), 4000);
    }
  }

  const copiado = estado === "copiado";

  return (
    <div className="pt-4">
      <div className="flex gap-2">
        <BotonFavorito
          forma="guardar"
          productId={favorito.productId}
          nombre={nombre}
          marcado={favorito.marcado}
          conSesion={conSesion}
          volver={volver}
        />

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
        Lo anuncia una región viva: cambiar el nombre accesible del botón con
        foco suena como si hubiera aparecido otro.
      */}
      <p aria-live="polite" className="sr-only">
        {copiado ? "Enlace copiado al portapapeles" : ""}
      </p>
    </div>
  );
}
