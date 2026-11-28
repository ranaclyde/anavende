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
  type SearchParamsRecord,
} from "@/modules/catalog/products/filtros";
import {
  contarPorEstado,
  listarProductos,
  opcionesDeProducto,
} from "@/modules/catalog/products/queries";
import { umbralDeStockBajo } from "@/modules/settings/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductosDelPanel({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const filtros = leerFiltros(await searchParams);

  // Antes que el listado: «para reponer» se filtra en la base con el umbral.
  const umbral = await umbralDeStockBajo();

  // `coincidencias` pasa solapa y filtros (decide las páginas); `conteo` es
  // por solapa sin filtros (separa «no cargaste ninguno» de «ninguno
  // coincide»).
  const [{ productos, total: coincidencias }, conteo, { marcas, categorias }] =
    await Promise.all([
      listarProductos(filtros, umbral),
      contarPorEstado(),
      opcionesDeProducto(),
    ]);

  // Una página que ya no existe lleva a la última que sí.
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
          /* Con el catálogo vacío lo ofrece el estado vacío: un solo botón de
             marca por pantalla (§6.3). */
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

      {/* Sin productos, no se muestran solapas ni filtros (§8). */}
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
            // El total es el de la solapa, no el del catálogo entero.
            total={conteo[filtros.estado]}
            porPagina={POR_PAGINA}
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
