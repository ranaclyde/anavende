import type { Metadata } from "next";

import { ListadoDeProductos } from "@/components/admin/productos/listado";
import { listarProductos } from "@/modules/catalog/products/queries";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductosDelPanel() {
  const items = await listarProductos();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Productos</h1>
        <p className="text-body-sm text-ink-secondary">
          Lo que se ve en la tienda: nombre, precio, descripción y estado.
        </p>
      </div>

      <ListadoDeProductos items={items} />
    </div>
  );
}
