import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormularioDeProducto } from "@/components/admin/productos/formulario";
import { opcionesDeProducto } from "@/modules/catalog/products/queries";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProducto() {
  const { marcas, categorias } = await opcionesDeProducto();

  // Se mira `isActive` y no la existencia: el selector solo ofrece las
  // activas (RN-11b), así que una marca desactivada no se puede elegir y
  // para esta pantalla es lo mismo que no tenerla.
  const faltan = [
    {
      nombre: "una marca",
      href: "/admin/catalogo/marcas",
      accion: "Crear una marca",
      opciones: marcas,
    },
    {
      nombre: "una categoría",
      href: "/admin/catalogo/categorias",
      accion: "Crear una categoría",
      opciones: categorias,
    },
  ].filter((r) => r.opciones.every((o) => !o.isActive));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Volver />
      <h1 className="text-title text-ink">Nuevo producto</h1>

      {/* El formulario NO se pinta si no se puede completar. Sin esta guarda
          el selector de marca queda con una sola opción —«Elegí una marca»,
          que es el texto de «no elegiste nada»— y recién al guardar aparece
          un error que dice «Elegí una marca»: una instrucción imposible de
          obedecer, después de haber escrito el nombre, el precio, la
          descripción y subido las fotos. */}
      {faltan.length > 0 ? (
        <FaltaCargar faltan={faltan} />
      ) : (
        <FormularioDeProducto
          producto={null}
          marcas={marcas}
          categorias={categorias}
        />
      )}
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

/**
 * Estado vacío de esta pantalla (§8): dice qué falta, por qué hace falta y
 * ofrece el paso siguiente. Nombra las dos cosas cuando faltan las dos, para
 * que nadie cree una marca, vuelva, y se encuentre con que ahora falta la
 * categoría.
 */
function FaltaCargar({
  faltan,
}: {
  faltan: readonly { nombre: string; href: string; accion: string }[];
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading text-ink">
          Antes hay que cargar {faltan.map((f) => f.nombre).join(" y ")}
        </h2>
        <p className="mx-auto max-w-md text-body-sm text-ink-secondary">
          Todo producto lleva una marca y una categoría: son las que arman el
          menú de la tienda y por las que el comprador filtra. Se cargan una
          vez y sirven para todo el catálogo.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {faltan.map((f, i) => (
          <Button
            key={f.href}
            asChild
            variant={i === 0 ? "brand" : "secondary"}
            size="sm"
          >
            <Link href={f.href}>{f.accion}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
