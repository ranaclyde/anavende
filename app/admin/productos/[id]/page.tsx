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

/** En Next 16 `params` y `searchParams` son asíncronos (§10.2). */
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agregar?: string }>;
};

/**
 * El alta de un producto termina acá **con el diálogo de «Agregar color» ya
 * abierto**, y eso viaja en la dirección y no en memoria.
 *
 * Un producto sin colores no tiene stock ni fotos, así que no se puede
 * vender: crear el producto es media tarea, y la bajada de «Nuevo producto»
 * ya promete «la pantalla que se abre sola al crearlo». Hasta hoy la promesa
 * era falsa — se llegaba a la ficha con la tarjeta de colores abajo de todo y
 * había que encontrarla.
 *
 * **En la URL y no en un estado que se pasa de una pantalla a otra** (§10.2):
 * así el enlace se puede pegar en cualquier lado —«andá a cargarle un color a
 * esto»—, el atrás funciona, y no hace falta que dos pantallas se pongan de
 * acuerdo sobre algo invisible. Al cerrar el diálogo el parámetro se saca,
 * porque si se quedara, recargar volvería a abrirlo sobre un color ya
 * cargado.
 */
const ABRIR_ALTA_DE_COLOR = "color";

/**
 * La dirección la escribe cualquiera. Sin esta guarda, `/admin/productos/hola`
 * le manda a Postgres algo que no es un uuid y la página revienta con un 500
 * en vez de decir que no existe.
 */
const ES_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarProducto({ params, searchParams }: Props) {
  const [{ id }, consulta] = await Promise.all([params, searchParams]);

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

      {/* Dos columnas cuando hay lugar para las dos, y una sola cuando no.

          **El formulario conserva el ancho que tiene en el alta**, 1024px, y
          el stock se queda con el resto. Es lo único que impide el salto que
          §4.1 existe para evitar: se viene de «Nuevo producto», que es este
          mismo formulario, y si acá midiera otra cosa los campos cambiarían
          de tamaño entre una pantalla y la siguiente. Antes el salto era de
          lugar y se arregló alineando a la izquierda; éste era de ancho, y lo
          introdujo el paso anterior de este mismo trabajo.

          **La consulta es de contenedor y no de ventana**, y ahí hay una
          razón concreta: el menú lateral se contrae a pedido y libera 176px.
          Con una consulta de ventana, contraerlo —que es justo lo que se hace
          para ganar ancho— no cambiaría nada. `@container` mide lo que de
          verdad hay.

          **1400px es la suma de lo que hace falta**: 1024 del formulario, 16
          de separación y 360 del stock, que es lo que necesita una fila de
          tres fotos. Por debajo van apiladas y las dos topeadas en 1024,
          exactamente como se veía la pantalla antes de partirla en dos.

          El orden de las columnas es el del DOM en los dos casos, así que el
          recorrido con teclado no se despega de lo que se ve. */}
      <div className="@container">
        <div className="flex max-w-admin-form flex-col gap-4 @min-[1400px]:max-w-none @min-[1400px]:flex-row @min-[1400px]:items-start">
          <div className="min-w-0 @min-[1400px]:w-admin-form @min-[1400px]:shrink-0">
            <FormularioDeProducto
              producto={producto}
              marcas={opciones.marcas}
              categorias={opciones.categorias}
            />
          </div>

          {/* Fuera del formulario, y a propósito: cada variante se guarda
              sola, en el momento. Meterlas adentro obligaría a apretar
              «Guardar cambios» para que una foto ya subida quedara en firme,
              y a explicar por qué una imagen que ya está en Storage todavía
              no cuenta. Que sea hermana y no hija es también lo que permite
              ponerla en la otra columna sin anidar un `<form>` adentro de
              otro. */}
          <div className="min-w-0 @min-[1400px]:flex-1">
            <VariantesDelProducto
              productId={producto.id}
              productoActivo={producto.isActive}
              variantes={variantes}
              colores={colores}
              abrirAlta={consulta.agregar === ABRIR_ALTA_DE_COLOR}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
