import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { opcionesDeProducto } from "@/modules/catalog/products/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProducto() {
  await exigirAdmin();

  const { marcas, categorias } = await opcionesDeProducto();

  // Sin marcas ni categorías el formulario se pinta igual (F2.13): cada
  // selector ofrece crear la que falta sin salir de acá. Hasta entonces esta
  // pantalla mandaba a Catálogo y había que volver a empezar.
  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nuevo producto"
        bajada="Cargás primero los datos básicos y después el stock."
        volver={{ href: "/admin/productos", etiqueta: "Productos" }}
      />

      <FormularioDeProducto
        producto={null}
        marcas={marcas}
        categorias={categorias}
      />
    </div>
  );
}
