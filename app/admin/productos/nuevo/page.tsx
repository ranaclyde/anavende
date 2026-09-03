import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { opcionesDeProducto } from "@/modules/catalog/products/queries";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProducto() {
  const { marcas, categorias } = await opcionesDeProducto();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Volver />
      <h1 className="text-title text-ink">Nuevo producto</h1>
      <FormularioDeProducto
        producto={null}
        marcas={marcas}
        categorias={categorias}
      />
    </div>
  );
}

function Volver() {
  return (
    <Link
      href="/admin/productos"
      className="inline-flex items-center gap-1 self-start text-body-sm text-ink-secondary hover:text-ink"
    >
      <ChevronLeft aria-hidden className="size-4" />
      Productos
    </Link>
  );
}
