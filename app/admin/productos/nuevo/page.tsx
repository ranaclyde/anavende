import { Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { VacioDelPanel } from "@/components/admin/vacio";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
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
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Nuevo producto"
        bajada="Acá van los datos y el precio. Los colores, el stock y las fotos se cargan después, en la pantalla que se abre sola al crearlo."
        volver={{ href: "/admin/productos", etiqueta: "Productos" }}
      />

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
    <VacioDelPanel
      como="h2"
      icono={Tags}
      titulo={`Antes hay que cargar ${faltan.map((f) => f.nombre).join(" y ")}`}
      accion={
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
      }
    >
      Todo producto lleva una marca y una categoría: son las que arman el menú
      de la tienda y por las que el comprador filtra. Se cargan una vez y sirven
      para todo el catálogo.
    </VacioDelPanel>
  );
}
