import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RotateCcw } from "lucide-react";

import { Compra } from "@/components/shop/ficha/compra";
import { Descripcion } from "@/components/shop/ficha/descripcion";
import { Precio } from "@/components/shop/precio";
import { Button } from "@/components/ui/button";
import { urlDelSitio } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";
import { leerFicha, varianteInicial } from "@/modules/catalog/products/ficha";
import {
  mediosDePagoDeLaTienda,
  numeroDeWhatsApp,
  type MedioDePagoDeLaTienda,
} from "@/modules/settings/queries";

/**
 * Ficha de producto — F3.5, RF-03, DESIGN-REFERENCE §6.5, §6.8, §7.3.
 *
 * Es a donde apunta cada tarjeta del catálogo desde F3.1, y hasta hoy era un
 * 404.
 *
 * **Lo que cambia con el color vive en una isla de cliente** (`Compra`), y lo
 * que no —nombre, marca, precio, descripción, información de envío— se pinta
 * en el servidor y le entra como nodo. El precio es el caso que lo justifica
 * solo: formatearlo en el navegador significaría mandarle `decimal.js` entero
 * para poner un punto de miles.
 *
 * **Nada de recomendados todavía.** RF-03 los pide y son F8.2 y F8.4: un
 * bloque «También te puede interesar» exige la cascada de §11.2, que sin
 * catálogo real no se puede ni calibrar ni ver. La pantalla queda con lugar
 * para los dos.
 */

type Props = {
  // En Next 16 las dos son promesas.
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string | string[] }>;
};

/** El primer valor: `?color=a&color=b` llega como arreglo y no debe fallar. */
function unColor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Metadatos — lo mínimo para que el título del navegador y una pestaña
 * guardada digan qué producto es. **Los datos estructurados, la imagen de
 * Open Graph y el `canonical` son F3.9**, que es la tarea de SEO: meterlos
 * acá a medias daría una vista previa de WhatsApp incompleta, que es peor que
 * ninguna.
 *
 * `leerFicha` está envuelta en `cache()`, así que esta consulta y la de la
 * página son la misma.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ficha = await leerFicha(slug);

  if (!ficha) return { title: "Producto no encontrado" };

  const resumen = ficha.descripcionTexto.trim().replace(/\s+/g, " ");

  return {
    title: `${ficha.nombre} — ${ficha.marca}`,
    description: resumen
      ? resumen.slice(0, 155)
      : `${ficha.nombre} de ${ficha.marca}. Entrega en Viedma, Carmen de Patagones y alrededores.`,
  };
}

export default async function FichaDeProducto({ params, searchParams }: Props) {
  const { slug } = await params;

  // Independientes entre sí: encadenarlas sumaría dos viajes a la base para
  // datos que no dependen del producto.
  const [ficha, whatsapp, mediosDePago, consulta] = await Promise.all([
    leerFicha(slug),
    numeroDeWhatsApp(),
    mediosDePagoDeLaTienda(),
    searchParams,
  ]);

  // RN-05: un producto inactivo no existe para el sitio público, y da el
  // mismo 404 que uno que nunca existió.
  if (!ficha) notFound();

  const inicial = varianteInicial(ficha.variantes, unColor(consulta.color));

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Migas categoria={ficha.categoria} categoriaId={ficha.categoriaId} />

      <Compra
        producto={{
          nombre: ficha.nombre,
          marca: ficha.marca,
          // ABSOLUTA: viaja adentro de un mensaje de WhatsApp, donde una
          // dirección relativa no lleva a ninguna parte.
          url: `${urlDelSitio()}/productos/${ficha.slug}`,
          // Ya formateado: ver el comentario de arriba sobre `decimal.js`.
          precioFinalFormateado: formatMoney(ficha.precioFinal),
        }}
        variantes={ficha.variantes}
        inicial={Math.max(0, inicial)}
        whatsapp={whatsapp}
        encabezado={
          <header className="flex flex-col gap-2">
            <p className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
              {ficha.marca}
            </p>
            {/*
              El `h1` de la página es el nombre del producto. De ahí sale que
              «Descripción» sea `h2` y que el subtítulo de adentro sea `h3`
              (RF-15, DR §6.11): la jerarquía de la ficha se decide acá.
            */}
            <h1 className="text-title text-ink">{ficha.nombre}</h1>
            <Precio
              className="pt-2"
              tamano="ficha"
              precio={ficha.precio}
              descuento={ficha.descuento}
              precioFinal={ficha.precioFinal}
            />
          </header>
        }
        informacion={
          <Informacion
            mediosDePago={mediosDePago}
            descripcion={ficha.descripcion}
          />
        }
      />
    </div>
  );
}

/**
 * Dónde está parado el producto. RF-03 pide mostrar la categoría, y como
 * enlace además resuelve la pregunta que sigue: «mostrame más de esto».
 *
 * Apunta al catálogo filtrado —`/productos?categoria=…`— y no a una pantalla
 * de categoría, que no existe: §10.2 dice que el filtro ES la dirección.
 */
function Migas({
  categoria,
  categoriaId,
}: {
  categoria: string;
  categoriaId: string;
}) {
  return (
    <nav aria-label="Miga de pan" className="pb-6">
      <ol className="flex flex-wrap items-center gap-1 text-body-sm text-ink-secondary">
        <li>
          <Link href="/productos" className="rounded-pill hover:text-ink">
            Catálogo
          </Link>
        </li>
        <li aria-hidden className="text-ink-tertiary">
          <ChevronRight className="size-4" />
        </li>
        <li>
          <Link
            href={urlDeTienda({ categoria: categoriaId })}
            className="rounded-pill hover:text-ink"
          >
            {categoria}
          </Link>
        </li>
      </ol>
    </nav>
  );
}

/**
 * Todo lo que va debajo de las acciones — F3.5, RF-03, RF-15, RF-19, RN-10,
 * DR §7.3 (reescrito el 2026-09-08).
 *
 * Antes eran tres renglones sueltos —envío, medios de pago, garantías— y
 * ahora son tres bloques con jerarquía: **los datos** que se leen de un
 * vistazo, **la descripción** que escribió la vendedora, y **el recuadro**
 * que explica qué pasa después de apretar el botón.
 *
 * Ese último es el que faltaba. La tienda no cobra ni despacha sola (RN-08,
 * RN-10): el pedido termina en una conversación de WhatsApp, y quien no lo
 * sabe de antemano lee «Comprá ya» y espera un carrito con tarjeta. Decirlo
 * ANTES de que aprete es la diferencia entre un proceso raro y un proceso
 * que se entiende.
 *
 * **Ya no dice «PedidosYa».** RN-10 pasó a hablar de entrega local y no de
 * una empresa concreta: la mensajería puede cambiar, y el dato que le sirve a
 * quien compra no es el nombre del cadete sino hasta dónde llegamos.
 */
function Informacion({
  mediosDePago,
  descripcion,
}: {
  mediosDePago: MedioDePagoDeLaTienda[];
  descripcion: string;
}) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <Datos mediosDePago={mediosDePago} />
      <Descripcion markdown={descripcion} />
      <ComoSigue />
    </div>
  );
}

/**
 * Las tres cosas que alguien quiere saber antes de escribir, en tres
 * renglones y sin adornos.
 *
 * **Los medios de pago se nombran, ya no se dibujan.** Estaban como una tira
 * de logos, que en una página de venta se lee como «pagá acá» — y acá no se
 * paga: no hay checkout con tarjeta y no va a haberlo en el MVP (FA-04,
 * RN-08). La tira sigue en el pie y en el home, donde es una señal de
 * confianza y no una promesa de un botón. Los nombres salen igual de lo que
 * cargó la vendedora (RF-19), así que agregar un medio sigue siendo cargar
 * una fila.
 */
function Datos({ mediosDePago }: { mediosDePago: MedioDePagoDeLaTienda[] }) {
  const nombres = mediosDePago.map((m) => m.nombre);
  const lista =
    nombres.length > 1
      ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`
      : nombres[0];

  return (
    <ul className="flex flex-col gap-1.5 text-body-sm text-ink-secondary">
      <li>Productos nuevos y en su caja original.</li>
      <li>Entrega en Viedma, Carmen de Patagones y alrededores.</li>
      <li>
        Coordinamos el pago al confirmar el pedido
        {lista ? <>: {lista}</> : null}.
      </li>
    </ul>
  );
}

/**
 * Qué pasa después del botón (RN-08, RN-10).
 *
 * El botón de garantías vive ADENTRO del recuadro y no suelto abajo: es la
 * pregunta que sigue a «coordinamos la entrega» —«¿y si no me sirve?»— y
 * suelto en la página era un enlace más entre otros.
 */
const PASOS = [
  "Armás el pedido y lo mandás como orden de compra, o nos escribís directo por WhatsApp.",
  "Te confirmamos stock, precio final y forma de pago.",
  "Coordinamos la entrega en Viedma, Carmen de Patagones y alrededores, o pasás a retirarlo.",
];

function ComoSigue() {
  return (
    <section
      aria-labelledby="como-sigue"
      className="mt-10 rounded-card bg-surface p-5 shadow-md"
    >
      <h2 id="como-sigue" className="text-body-lg font-medium text-ink">
        ¿Cómo sigue después de comprar?
      </h2>

      <ol className="mt-4 flex flex-col gap-3 text-body-sm text-ink-secondary">
        {PASOS.map((paso, i) => (
          <li key={paso} className="flex items-start gap-3">
            {/*
              El número está DOS veces: como `<li>` de una lista ordenada, que
              es lo que lee un lector de pantalla, y como círculo dibujado,
              que es lo que se ve. Por eso el círculo va `aria-hidden` — si
              no, se anunciaría «uno, uno».
            */}
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
