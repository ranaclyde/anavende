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
    <div className="flex w-full flex-col gap-4">
      <EncabezadoDePanel
        titulo={producto.name}
        volver={{ href: "/admin/productos", etiqueta: "Productos" }}
      />

      {/* Dos columnas desde `xl`, como la ficha de usuario (§4.1): a la
          izquierda el formulario, a la derecha el stock. Por debajo siguen
          una debajo de la otra y EN ESTE ORDEN, que es el orden del DOM: así
          el recorrido con teclado y el de la vista son el mismo en los dos
          casos.

          **Las dos columnas llevan tope, y los dos números están medidos.**
          34rem es lo que necesita el formulario para que los pares —precio y
          descuento, marca y categoría— sigan en dos columnas; 44rem es lo
          que necesita una fila de fotos para entrar entera: cinco de 96px
          más la de «Agregar», con 8 de separación, son 616, y la tarjeta se
          lleva 56 entre su relleno y el del color. Sin el segundo tope, a
          1920 la columna medía 1072: el botón «Agregar color» quedaba a 900
          del título y dos fotos flotaban en un desierto. */}
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,34rem)_minmax(0,44rem)] xl:items-start">
        <FormularioDeProducto
          producto={producto}
          marcas={opciones.marcas}
          categorias={opciones.categorias}
        />

        {/* Fuera del formulario, y a propósito: cada variante se guarda sola,
            en el momento. Meterlas adentro obligaría a apretar «Guardar
            cambios» para que una foto ya subida quedara en firme, y a
            explicar por qué una imagen que ya está en Storage todavía no
            cuenta. Que sea hermana y no hija es también lo que permite
            ponerla en la otra columna sin anidar un `<form>` adentro de
            otro. */}
        <VariantesDelProducto
          productId={producto.id}
          productoActivo={producto.isActive}
          variantes={variantes}
          colores={colores}
        />
      </div>
    </div>
  );
}
