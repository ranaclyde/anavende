import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { BarraDeFiltros } from "@/components/admin/ordenes/filtros";
import {
  ListadoDeOrdenes,
  SinOrdenes,
} from "@/components/admin/ordenes/listado";
import { SolapasDeEstado } from "@/components/admin/ordenes/solapas";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import { Button } from "@/components/ui/button";
import {
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type SearchParamsRecord,
} from "@/modules/orders/filtros-panel";
import {
  contarPorEstado,
  listarOrdenesDelPanel,
} from "@/modules/orders/queries-panel";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Órdenes" };

/**
 * Abre en «Activas», lo que hay que preparar. El estado vive en la URL
 * (§10.2): el inicio del panel y los emails enlazan a vistas concretas.
 */
export default async function OrdenesDelPanel({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const filtros = leerFiltros(await searchParams);

  const [{ ordenes, total }, conteo] = await Promise.all([
    listarOrdenesDelPanel(filtros),
    contarPorEstado(),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Una página que ya no existe lleva a la última que sí.
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  const hayOrdenes = conteo.activa + conteo.finalizada + conteo.cancelada > 0;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Órdenes"
        bajada="Los pedidos de la tienda y los que cargues a mano, con su estado."
        acciones={
          /* RF-24: arriba, porque no actúa sobre lo que se está mirando. */
          <Button asChild variant="brand" size="sm">
            <Link href="/admin/ordenes/nueva">
              <Plus aria-hidden />
              Nueva orden
            </Link>
          </Button>
        }
      />

      {/* Sin órdenes, no se muestran solapas ni filtros (§8). */}
      {!hayOrdenes ? (
        <SinOrdenes />
      ) : (
        <>
          <SolapasDeEstado filtros={filtros} conteo={conteo} />
          <BarraDeFiltros
            filtros={filtros}
            total={total}
            porPagina={POR_PAGINA}
          />
          <ListadoDeOrdenes ordenes={ordenes} filtros={filtros} />
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
