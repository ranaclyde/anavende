import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";

import { DatosEstructurados } from "@/components/seo/datos-estructurados";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { Compra } from "@/components/shop/ficha/compra";
import { CuotasDeLaFicha } from "@/components/shop/ficha/cuotas";
import { Descripcion } from "@/components/shop/ficha/descripcion";
import {
  EsqueletoDeRecomendados,
  Recomendados,
} from "@/components/shop/recomendados";
import { VistosRecientemente } from "@/components/shop/vistos";
import { RegistrarVista } from "@/components/shop/vistos-cliente";
import { Precio } from "@/components/shop/precio";
import { Sku } from "@/components/shop/ficha/sku";
import { Button } from "@/components/ui/button";
import {
  breadcrumbsJsonLd,
  productJsonLd as productoEstructurado,
} from "@/lib/structured-data";
import { formatMoney } from "@/lib/money";
import {
  OPEN_GRAPH_BASE,
  metaDescription,
  absoluteUrl,
  DELIVERY_AREA,
} from "@/lib/seo";
import { getSession } from "@/lib/session";
import { TOUCH_AREA, cn } from "@/lib/utils";
import { mirar } from "@/modules/cart/pendiente";
import { urlDeCategoria } from "@/modules/catalog/products/filtros-tienda";
import {
  leerFicha,
  varianteInicial,
  type Ficha,
} from "@/modules/catalog/products/ficha";
import { esFavorito } from "@/modules/users/favoritos/queries";
import { promocionesParaElPrecio } from "@/modules/settings/promociones";
import {
  numeroDeWhatsApp,
  promocionesVigentes,
} from "@/modules/settings/queries";

/**
 * Lo que cambia con el color vive en una isla de cliente (`Compra`); lo demás
 * se pinta en el servidor y le entra como nodo. El precio llega formateado:
 * hacerlo en el navegador mandaría `decimal.js` entero.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string | string[] }>;
};

/** `?color=a&color=b` llega como arreglo y no debe fallar. */
function unColor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Todas y en WEBP, al revés que Open Graph, y no es una inconsistencia: Google
 * lee WEBP y aprovecha varias; la vista previa de un chat muestra una y no
 * decodifica WEBP.
 */
function fotosEstructuradas(ficha: Ficha): string[] {
  const conFotos = ficha.variantes.find((v) => v.imagenes.length > 0);
  return (conFotos?.imagenes ?? []).map((i) => i.grande);
}

/**
 * Para Open Graph: una sola, en `-og.jpg` (WhatsApp no dibuja WEBP), y la de la
 * primera variante con fotos y no la del `?color=`, porque el canónico no lo
 * lleva y la vista previa tiene que ser siempre la misma. Puede venir vacía:
 * el producto y las fotos se cargan en dos pasos.
 */
function fotoDelProducto(
  ficha: Ficha,
): { url: string; alt: string; width: number; height: number }[] {
  const foto = ficha.variantes.find((v) => v.imagenes.length > 0)?.imagenes[0];

  if (!foto) return [];

  return [
    {
      url: foto.og,
      // El texto alternativo lo escribe la vendedora y puede no estar.
      alt: foto.alt ?? `${ficha.nombre} — ${ficha.marca}`,
      // El lienzo es fijo (TAMANOS.og). Sin las medidas, algunos clientes se
      // caen a la miniatura chica antes que bajar la imagen para averiguarlas.
      width: 1200,
      height: 630,
    },
  ];
}

/**
 * El `canonical` no lleva `?color=`: cada color es una vista del mismo
 * producto. El precio va solo en la descripción de Open Graph (WhatsApp no
 * muestra otra cosa); en Google lo pone el dato estructurado. Ojo: WhatsApp
 * guarda la tarjeta la primera vez y no la vuelve a pedir, así que un mensaje
 * viejo puede mostrar un precio viejo.
 *
 * `leerFicha` está en `cache()`: esta consulta y la de la página son la misma.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ficha = await leerFicha(slug);

  // Un 404 no se indexa por definición, pero el título se ve en la pestaña.
  if (!ficha) return { title: "Producto no encontrado" };

  const ruta = `/productos/${ficha.slug}`;
  const titulo = `${ficha.nombre} — ${ficha.marca}`;
  const descripcion =
    metaDescription(ficha.descripcionTexto) ||
    `${ficha.nombre} de ${ficha.marca}. ${DELIVERY_AREA}`;
  const conPrecio = `${formatMoney(ficha.precioFinal)} · ${descripcion}`;
  const fotos = fotoDelProducto(ficha);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      url: ruta,
      title: titulo,
      description: conPrecio,
      // Sin fotos queda la tarjeta de la marca de `OPEN_GRAPH_BASE`.
      ...(fotos.length > 0 ? { images: fotos } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: conPrecio,
      ...(fotos.length > 0 ? { images: fotos } : {}),
    },
  };
}

export default async function FichaDeProducto({ params, searchParams }: Props) {
  const { slug } = await params;

  // La sesión entera, con perfil, y no solo la identidad: las acciones de los
  // botones exigen perfil, y con la identidad sola quien no completó el perfil
  // veía «Agregá al carrito» y recibía «Necesitás iniciar sesión». No cuesta
  // otra ida: el layout ya la pidió y `getSession` está en `cache()`.
  const [ficha, whatsapp, consulta, sesion, vigentes] = await Promise.all([
    leerFicha(slug),
    numeroDeWhatsApp(),
    searchParams,
    getSession(),
    promocionesVigentes(),
  ]);
  const identidad = sesion?.identity ?? null;

  // Un producto inactivo da el mismo 404 que uno que nunca existió (RN-05).
  if (!ficha) notFound();

  // La compra pendiente de ingresar: sin perfil la nota sigue esperando. Solo
  // se mira, no se toma: un Server Component puede leer cookies pero no
  // borrarlas, así que la consume la acción. Es una sola y global: si es de
  // otro producto, se queda para cuando vuelva a esa ficha.
  const [pendiente, guardado] = identidad
    ? await Promise.all([mirar(), esFavorito(identidad.userId, ficha.id)])
    : [null, false];
  const iPendiente = pendiente
    ? ficha.variantes.findIndex((v) => v.id === pendiente.variantId)
    : -1;

  const color = unColor(consulta.color);

  // El color de la dirección manda; la variante pendiente es el respaldo para
  // cuando el enlace del email llega con la consulta comida.
  const inicial =
    !color && iPendiente !== -1
      ? iPendiente
      : varianteInicial(ficha.variantes, color);

  return (
    <div className="group/ficha mx-auto w-full max-w-shop px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* Lo mismo de la pantalla, en schema.org. */}
      <DatosEstructurados
        datos={[
          productoEstructurado(ficha, fotosEstructuradas(ficha)),
          breadcrumbsJsonLd(ficha),
        ]}
      />

      {/* A la altura de las migas: al pie no la encontraba nadie. */}
      <div className="flex items-center justify-between gap-4 pb-6">
        <Migas
          categoria={ficha.categoria}
          categoriaSlug={ficha.categoriaSlug}
        />
        <AyudaGuiada
          id="ficha"
          pasos={pasosDeLaFicha(identidad !== null)}
          // Con CSS y no con el stock del servidor: el stock depende del color
          // elegido en el navegador, y sin el botón del carrito la guía no arranca.
          className="-my-2 -mr-2 hidden shrink-0 group-has-[[data-ayuda=comprar-carrito]]/ficha:inline-flex"
        />
      </div>

      {/*
        `encabezado` e `informacion` llevan `key` porque `Compra` los pone en
        la misma lista que sus hijos; sin ella React avisa en algunas fichas.
      */}
      <Compra
        producto={{
          nombre: ficha.nombre,
          marca: ficha.marca,
          // Absoluta: viaja adentro de un mensaje de WhatsApp.
          url: absoluteUrl(`/productos/${ficha.slug}`),
          ruta: `/productos/${ficha.slug}`,
          precioFinalFormateado: formatMoney(ficha.precioFinal),
        }}
        variantes={ficha.variantes}
        inicial={Math.max(0, inicial)}
        whatsapp={whatsapp}
        conSesion={identidad !== null}
        pendiente={iPendiente !== -1}
        favorito={{ productId: ficha.id, marcado: guardado }}
        encabezado={
          <header key="encabezado" className="flex flex-col gap-2">
            {/* Sin versalitas: en mayúsculas parecía más importante que el nombre. */}
            <p className="-mb-1 text-caption text-ink-secondary">
              {ficha.marca}
            </p>
            {/* De este `h1` sale que «Descripción» sea `h2` y su subtítulo `h3`. */}
            <h1 className="text-title text-ink">{ficha.nombre}</h1>
            {/* Entre el nombre y el precio. */}
            {ficha.sku ? <Sku sku={ficha.sku} /> : null}
            <Precio
              className="pt-2"
              tamano="ficha"
              precio={ficha.precio}
              descuento={ficha.descuento}
              precioFinal={ficha.precioFinal}
            />
            {/* Debajo del precio, porque divide ese número. */}
            <CuotasDeLaFicha
              promociones={promocionesParaElPrecio(vigentes, ficha.precioFinal)}
            />
            <Datos />
          </header>
        }
        informacion={
          <Informacion key="informacion" descripcion={ficha.descripcion} />
        }
      />

      <Suspense fallback={<EsqueletoDeRecomendados />}>
        <Recomendados
          productoId={ficha.id}
          ruta={`/productos/${ficha.slug}`}
          categoria={{ slug: ficha.categoriaSlug, nombre: ficha.categoria }}
          userId={identidad?.userId ?? null}
        />
      </Suspense>

      {/* La ficha se anota en el historial y muestra el resto. */}
      <RegistrarVista productoId={ficha.id} />
      <Suspense fallback={null}>
        <VistosRecientemente
          excluir={ficha.id}
          ruta={`/productos/${ficha.slug}`}
          className="mt-16"
        />
      </Suspense>
    </div>
  );
}

function Migas({
  categoria,
  categoriaSlug,
}: {
  categoria: string;
  categoriaSlug: string;
}) {
  return (
    <nav aria-label="Miga de pan">
      <ol className="flex flex-wrap items-center gap-1 text-body-sm text-ink-secondary">
        <li>
          {/* La zona sensible se estira a 44px sin tocar el dibujo (§9). */}
          <Link
            href="/productos"
            className={cn("relative rounded-pill hover:text-ink", TOUCH_AREA)}
          >
            Productos
          </Link>
        </li>
        <li aria-hidden className="text-ink-tertiary">
          <ChevronRight className="size-4" />
        </li>
        <li>
          <Link
            href={urlDeCategoria(categoriaSlug)}
            className={cn("relative rounded-pill hover:text-ink", TOUCH_AREA)}
          >
            {categoria}
          </Link>
        </li>
      </ol>
    </nav>
  );
}

function Informacion({ descripcion }: { descripcion: string }) {
  // Mismo aire arriba y abajo de la línea: los bloques de adentro no traen
  // margen propio y los separa el `gap`.
  return (
    <div className="mt-8 flex flex-col gap-10 border-t border-border pt-8">
      <Descripcion markdown={descripcion} />
      <ComoSigue />
    </div>
  );
}

function Datos() {
  return (
    <ul className="flex flex-col gap-1.5 pt-2 text-body-sm text-ink-secondary">
      <li>
        <strong className="font-semibold text-ink">Producto nuevo</strong>, en
        su caja original.
      </li>
      <li>Entrega en Viedma, Carmen de Patagones y alrededores.</li>
    </ul>
  );
}

const PASOS = [
  "Armás el pedido y lo mandás como orden de compra, o nos escribís directo por WhatsApp.",
  "Te confirmamos stock, precio final y forma de pago.",
  "Coordinamos la entrega en Viedma, Carmen de Patagones y alrededores, o pasás a retirarlo.",
];

/** Solo arranca con stock: el botón del carrito es el paso obligatorio. */
function pasosDeLaFicha(conSesion: boolean): PasoDeAyuda[] {
  return [
    {
      elemento: "elegir-color",
      titulo: "Elegí tu color",
      texto:
        "Cada color tiene sus propias fotos y su stock, así ves exactamente lo que te llevás.",
      opcional: true,
    },
    conSesion
      ? {
          elemento: "comprar-carrito",
          titulo: "Sumalo al carrito",
          texto:
            "Juntá todo lo que quieras y, cuando confirmes el pedido, te lo guardamos.",
        }
      : {
          elemento: "comprar-carrito",
          titulo: "Comprá con tu cuenta",
          texto:
            "Ingresá o creá tu cuenta y este producto te espera en el carrito. Además, vas a poder seguir tus pedidos.",
        },
    {
      elemento: "comprar-whatsapp",
      titulo: "¿Preferís escribirnos?",
      texto:
        "Comprá directo por WhatsApp, sin cuenta. El mensaje sale armado con el producto, el color y la cantidad.",
      opcional: true,
    },
    {
      elemento: "como-sigue",
      titulo: "Acá no se paga nada",
      texto:
        "Pagás recién cuando hablemos por WhatsApp. En este recuadro te contamos cómo sigue todo.",
    },
  ];
}

function ComoSigue() {
  return (
    <section
      aria-labelledby="como-sigue"
      className="rounded-card bg-surface p-5 shadow-md"
      data-ayuda="como-sigue"
    >
      <h2 id="como-sigue" className="text-body-lg font-medium text-ink">
        ¿Cómo sigue después de comprar?
      </h2>

      <ol className="mt-4 flex flex-col gap-3 text-body-sm text-ink-secondary">
        {PASOS.map((paso, i) => (
          <li key={paso} className="flex items-start gap-3">
            {/* El `<ol>` ya numera para el lector de pantalla: si no, diría «uno, uno». */}
            <span
              aria-hidden
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-caption font-medium text-brand"
            >
              {i + 1}
            </span>
            <span>{paso}</span>
          </li>
        ))}
      </ol>

      <Button asChild variant="secondary" size="md" className="mt-5 w-full">
        <Link href="/legales/garantias">
          <RotateCcw aria-hidden />
          Garantías y devoluciones
        </Link>
      </Button>
    </section>
  );
}
