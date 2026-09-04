import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { BarraDeFiltros } from "@/components/admin/productos/filtros";
import {
  ListadoDeProductos,
  SinProductos,
} from "@/components/admin/productos/listado";
import { Button } from "@/components/ui/button";
import {
  leerFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros";
import {
  contarProductos,
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

  const [items, total, { marcas, categorias }] = await Promise.all([
    listarProductos(filtros, umbral),
    contarProductos(),
    opcionesDeProducto(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-ink">Productos</h1>
          <p className="text-body-sm text-ink-secondary">
            Lo que se ve en la tienda: nombre, precio, stock y estado.
          </p>
        </div>
        {/* Con el catálogo vacío este botón no está: el estado vacío ya
            ofrece el mismo primer paso en el medio de la pantalla, y dos
            botones de marca iguales a 100px uno del otro se leen como un
            error, no como una invitación (§6.3: una sola por pantalla). */}
        {total === 0 ? null : (
          <Button asChild variant="brand" size="sm">
            <Link href="/admin/productos/nuevo">
              <Plus aria-hidden />
              Nuevo producto
            </Link>
          </Button>
        )}
      </div>

      {/* Sin ningún producto cargado la barra no tiene sobre qué operar:
          cuatro filtros vacíos arriba de un cartel que dice «todavía no
          cargaste ninguno» son ruido, no ayuda (§8). */}
      {total === 0 ? (
        <SinProductos />
      ) : (
        <>
          <BarraDeFiltros
            filtros={filtros}
            marcas={marcas}
            categorias={categorias}
            mostrados={items.length}
            total={total}
          />

          <ListadoDeProductos
            items={items}
            filtros={filtros}
            umbral={umbral}
          />
        </>
      )}
    </div>
  );
}
