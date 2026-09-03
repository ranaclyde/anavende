import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import {
  obtenerProducto,
  opcionesDeProducto,
} from "@/modules/catalog/products/queries";

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

  // Las dos consultas no dependen una de la otra: en serie, la página tarda
  // la suma de las dos por nada.
  const [producto, opciones] = await Promise.all([
    obtenerProducto(id),
    opcionesDeProducto(),
  ]);

  if (!producto) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        href="/admin/productos"
        className="inline-flex items-center gap-1 self-start text-body-sm text-ink-secondary hover:text-ink"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Productos
      </Link>
      <h1 className="text-title text-ink">{producto.name}</h1>
      <FormularioDeProducto
        producto={producto}
        marcas={opciones.marcas}
        categorias={opciones.categorias}
      />
    </div>
  );
}
