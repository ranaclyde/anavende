import { ArrowDown, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { CopiarEnlace } from "@/components/admin/productos/copiar-enlace";
import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { VariantesDelProducto } from "@/components/admin/productos/variantes";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import { Button } from "@/components/ui/button";
import {
  obtenerProducto,
  opcionesDeProducto,
} from "@/modules/catalog/products/queries";
import {
  categoriaQueSeVendePorColor,
  opcionesDeColor,
  variantesDelProducto,
} from "@/modules/catalog/variants/queries";
import { laMarcaDeAguaEstaActiva } from "@/modules/marca-de-agua/queries";
import { urlAbsoluta } from "@/lib/seo";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Editar producto" };

/**
 * El segundo paso es el que más ahorra: escribir el total sin lo reservado
 * deja el stock por debajo del real.
 */
const PASOS_DEL_PRODUCTO: PasoDeAyuda[] = [
  {
    elemento: "stock-del-color",
    titulo: "¿Cuánto podés vender?",
    texto:
      "Lo que manda es «disponibles»: el total menos lo guardado para órdenes activas. Las reservadas salen del total cuando finalizás la orden.",
  },
  {
    elemento: "corregir-stock",
    titulo: "Acá corregís el stock",
    texto:
      "Cuando entra mercadería o contás de nuevo, poné el total que tenés en la mano, con lo reservado incluido. Las reservas se descuentan solas.",
  },
];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agregar?: string }>;
};

/**
 * `?agregar=color` abre el diálogo de «Agregar color»: el alta termina acá.
 * Al cerrarlo el parámetro se saca, o recargar lo volvería a abrir.
 */
const ABRIR_ALTA_DE_COLOR = "color";

/** Sin esta guarda, un `id` que no es uuid da un 500 de Postgres y no un 404. */
const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarProducto({ params, searchParams }: Props) {
  await exigirAdmin();

  const [{ id }, consulta] = await Promise.all([params, searchParams]);

  if (!ES_UUID.test(id)) notFound();

  const [producto, opciones, variantes, colores, categoriaConColor, marca] =
    await Promise.all([
      obtenerProducto(id),
      opcionesDeProducto(),
      variantesDelProducto(id),
      opcionesDeColor(),
      categoriaQueSeVendePorColor(id),
      laMarcaDeAguaEstaActiva(),
    ]);

  if (!producto) notFound();

  return (
    <div className="flex w-full flex-col gap-4">
      <EncabezadoDePanel
        titulo={producto.name}
        volver={{ href: "/admin/productos", etiqueta: "Productos" }}
        acciones={
          // `flex-wrap`: a 390px los tres botones no entran en un renglón.
          <div className="flex flex-wrap items-center gap-2">
            {/* Sin colores no hay stock que explicar. */}
            {variantes.length > 0 ? (
              <AyudaGuiada
                id="panel-producto"
                pasos={PASOS_DEL_PRODUCTO}
                tamano="sm"
              />
            ) : null}
            {/* Solo activo: uno inactivo da 404 en la tienda también para
                quien administra (RN-05). */}
            {producto.isActive ? (
              <>
                {/* En otra pestaña, para no perder lo que se está editando. */}
                <Button asChild variant="tertiary" size="sm">
                  <a
                    href={`/productos/${producto.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver en la tienda
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
                <CopiarEnlace
                  url={urlAbsoluta(`/productos/${producto.slug}`)}
                />
              </>
            ) : null}
          </div>
        }
      />

      {/* El formulario conserva el ancho del alta (1024px) para que no salte
          al venir de «Nuevo producto» (§4.1). 1400px = 1024 + 16 + 360 del
          stock. Consulta de contenedor para que contraer el menú cuente. */}
      <div className="@container">
        {/* Apiladas, «Colores y stock» queda lejos: el atajo, solo entonces. */}
        <a
          href="#colores-y-stock"
          className="mb-4 inline-flex items-center gap-1.5 rounded-panel-control text-body-sm text-ink-secondary transition-colors duration-150 hover:text-ink @min-[1400px]:hidden"
        >
          <ArrowDown aria-hidden className="size-4" />
          Ir a colores, stock y fotos
          {variantes.length > 0 ? (
            <span className="tabular-nums">
              (
              {variantes.length === 1
                ? "1 color"
                : `${variantes.length} colores`}
              )
            </span>
          ) : null}
        </a>
        <div className="flex max-w-admin-form flex-col gap-4 @min-[1400px]:max-w-none @min-[1400px]:flex-row @min-[1400px]:items-start">
          <div className="min-w-0 @min-[1400px]:w-admin-form @min-[1400px]:shrink-0">
            <FormularioDeProducto
              producto={producto}
              marcas={opciones.marcas}
              categorias={opciones.categorias}
            />
          </div>

          {/* Fuera del formulario a propósito: cada variante se guarda sola, en
              el momento, y no se puede anidar un `<form>` en otro. */}
          <div className="min-w-0 @min-[1400px]:flex-1">
            <VariantesDelProducto
              productId={producto.id}
              productoActivo={producto.isActive}
              variantes={variantes}
              colores={colores}
              categoriaConColor={categoriaConColor}
              marcaDeAgua={marca}
              abrirAlta={consulta.agregar === ABRIR_ALTA_DE_COLOR}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
