import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RotateCcw, Truck } from "lucide-react";

import { Compra } from "@/components/shop/ficha/compra";
import { Descripcion } from "@/components/shop/ficha/descripcion";
import { Precio } from "@/components/shop/precio";
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
      : `${ficha.nombre} de ${ficha.marca}. Envíos por PedidosYa.`,
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
        informacion={<Informacion mediosDePago={mediosDePago} />}
      />

      <Descripcion markdown={ficha.descripcion} />
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
 * El bloque de abajo de §7.3: envío, medios de pago y garantías.
 *
 * Los tres están también en el pie, y no es una repetición ociosa: acá se
 * leen en el momento de decidir la compra, que es cuando la pregunta «¿cómo
 * me llega y cómo pago?» aparece. Al pie llega quien ya bajó buscándola.
 *
 * Los medios de pago son los **activos** que cargó la vendedora (RF-19). Si
 * no cargó ninguno, el renglón no se dibuja: una lista vacía de «medios de
 * pago aceptados» dice algo que no queremos decir.
 */
function Informacion({
  mediosDePago,
}: {
  mediosDePago: MedioDePagoDeLaTienda[];
}) {
  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 text-body-sm text-ink-secondary">
      <p className="flex items-start gap-2.5">
        <Truck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Enviamos por <span className="text-ink">PedidosYa</span>. El costo del
          envío se coordina y se abona junto con el pago, por WhatsApp.
        </span>
      </p>

      {mediosDePago.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-secondary">Aceptamos</p>
          <ul className="flex flex-wrap items-center gap-2">
            {mediosDePago.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-1.5 rounded-pill bg-surface px-2.5 py-1 text-caption text-ink shadow-sm"
              >
                {m.logoUrl ? (
                  // Fondo claro fijo: un logo ajeno llega como trazo sobre
                  // transparente y no se lo puede repintar (§6.10).
                  <span className="relative block size-4 overflow-hidden rounded-[3px] bg-logo-chip">
                    <Image
                      src={m.logoUrl}
                      alt=""
                      fill
                      sizes="16px"
                      className="object-contain"
                    />
                  </span>
                ) : null}
                {m.nombre}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="flex items-start gap-2.5">
        <RotateCcw aria-hidden className="mt-0.5 size-4 shrink-0" />
        <Link
          href="/legales/garantias"
          className="rounded-pill underline-offset-4 hover:text-ink hover:underline"
        >
          Garantías y devoluciones
        </Link>
      </p>
    </div>
  );
}
