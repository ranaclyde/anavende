import type { Metadata } from "next";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { opcionesDeProducto } from "@/modules/catalog/products/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProducto() {
  await requireAdmin();

  const { marcas, categorias } = await opcionesDeProducto();

  // Sin marcas ni categorías se pinta igual: cada selector ofrece crear la
  // que falta.
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
