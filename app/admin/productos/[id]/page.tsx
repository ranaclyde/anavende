import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { VariantesDelProducto } from "@/components/admin/productos/variantes";
import {
  obtenerProducto,
  opcionesDeProducto,
} from "@/modules/catalog/products/queries";
import {
  opcionesDeColor,
  variantesDelProducto,
} from "@/modules/catalog/variants/queries";

export const metadata: Metadata = { title: "Editar producto" };

/** En Next 16 `params` es asíncrono: hay que esperarlo (§10.2). */
type Props = { params: Promise<{ id: string }> };

/**
 * La dirección la escribe cualquiera. Sin esta guarda, `/admin/productos/hola`
 * le manda a Postgres algo que no es un uuid y la página revienta con un 500
 * en vez de decir que no existe.
 */
const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarProducto({ params }: Props) {
  const { id } = await params;

  if (!ES_UUID.test(id)) notFound();

  // Las cuatro consultas no dependen unas de otras: en serie, la página
  // tardaría la suma de las cuatro por nada.
  const [producto, opciones, variantes, colores] = await Promise.all([
    obtenerProducto(id),
    opcionesDeProducto(),
    variantesDelProducto(id),
    opcionesDeColor(),
  ]);

  if (!producto) notFound();

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo={producto.name}
        volver={{ href: "/admin/productos", etiqueta: "Productos" }}
      />
      <FormularioDeProducto
        producto={producto}
        marcas={opciones.marcas}
        categorias={opciones.categorias}
      />

      {/* Fuera del formulario, y a propósito: cada variante se guarda sola,
          en el momento. Meterlas adentro obligaría a apretar «Guardar
          cambios» para que una foto ya subida quedara en firme, y a explicar
          por qué una imagen que ya está en Storage todavía no cuenta. */}
      <VariantesDelProducto
        productId={producto.id}
        productoActivo={producto.isActive}
        variantes={variantes}
        colores={colores}
      />
    </div>
  );
}
