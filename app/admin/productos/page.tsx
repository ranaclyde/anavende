import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import { BarraDeFiltros } from "@/components/admin/productos/filtros";
import {
  ListadoDeProductos,
  SinProductos,
} from "@/components/admin/productos/listado";
import { SolapasDeEstadoDeProducto } from "@/components/admin/productos/solapas";
import { Button } from "@/components/ui/button";
import {
  leerFiltros,
  POR_PAGINA,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros";
import {
  contarPorEstado,
  listarProductos,
  opcionesDeProducto,
} from "@/modules/catalog/products/queries";
import { umbralDeStockBajo } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Productos" };

/**
 * Listado de productos — RF-15, RF-20.
 *
 * El estado del listado —búsqueda, filtros y orden— vive en la URL y no en
 * el cliente (§10.2): así se comparte, funciona el botón atrás y el
 * dashboard de F7.8 puede enlazar «para reponer» sin que esta pantalla tenga
 * que enterarse.
 */
export default async function ProductosDelPanel({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltros(await searchParams);

  // El umbral se pide primero porque el listado lo necesita: el filtro «para
  // reponer» se resuelve en la base (HAVING), no filtrando en memoria lo que
  // ya vino. Es una lectura por clave primaria de una fila.
  const umbral = await umbralDeStockBajo();

  // Dos cuentas, y son preguntas distintas: `coincidencias` es cuántos pasan
  // la solapa y los filtros —lo que decide cuántas páginas hay— y `conteo` es
  // cuántos hay en cada solapa sin mirar nada más, que es lo que dibujan las
  // solapas y lo que separa «todavía no cargaste ninguno» de «ninguno
  // coincide con esto» (§8).
  const [{ productos, total: coincidencias }, conteo, { marcas, categorias }] =
    await Promise.all([
      listarProductos(filtros, umbral),
      contarPorEstado(),
      opcionesDeProducto(),
    ]);

  // Pedir una página que ya no existe —un enlace viejo, o borrar productos
  // estando en la última— lleva a la última que sí existe, como en los otros
  // tres listados del panel.
  const paginas = Math.max(1, Math.ceil(coincidencias / POR_PAGINA));
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Productos"
        bajada="Lo que se ve en la tienda: nombre, precio, stock y estado."
        acciones={
          /* Con el catálogo vacío este botón no está: el estado vacío ya
             ofrece el mismo primer paso en el medio de la pantalla, y dos
             botones de marca iguales a 100px uno del otro se leen como un
             error, no como una invitación (§6.3: una sola por pantalla). */
          conteo.todos === 0 ? null : (
            <Button asChild variant="brand" size="sm">
              <Link href="/admin/productos/nuevo">
                <Plus aria-hidden />
                Nuevo producto
              </Link>
            </Button>
          )
        }
      />

      {/* Sin ningún producto cargado las solapas y la barra no tienen sobre
          qué operar: tres solapas en cero y tres filtros vacíos arriba de un
          cartel que dice «todavía no cargaste ninguno» son ruido, no ayuda
          (§8). */}
      {conteo.todos === 0 ? (
        <SinProductos />
      ) : (
        <>
          <SolapasDeEstadoDeProducto filtros={filtros} conteo={conteo} />

          <BarraDeFiltros
            filtros={filtros}
            marcas={marcas}
            categorias={categorias}
            mostrados={coincidencias}
            // El «de cuántos» es el de la solapa donde se está parada, no el
            // del catálogo entero: en «Inactivos», «3 de 47 productos» sería
            // contar contra un listado que no se está mirando.
            total={conteo[filtros.estado]}
          />

          <ListadoDeProductos
            items={productos}
            filtros={filtros}
            umbral={umbral}
          />

          <PaginacionDelPanel
            pagina={filtros.pagina}
            paginas={paginas}
            href={(n) => urlDeFiltros({ ...filtros, pagina: n })}
          />
        </>
      )}
    </div>
  );
}
