import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BarraDeFiltros } from "@/components/admin/ordenes/filtros";
import {
  ListadoDeOrdenes,
  SinOrdenes,
} from "@/components/admin/ordenes/listado";
import { SolapasDeEstado } from "@/components/admin/ordenes/solapas";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import {
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/orders/filtros-panel";
import {
  contarPorEstado,
  listarOrdenesDelPanel,
} from "@/modules/orders/queries-panel";

export const metadata: Metadata = { title: "Órdenes" };

/**
 * Listado de órdenes — RF-21, DR §5.2 y §6.9. Tarea F7.1.
 *
 * Es la pantalla con la que la vendedora empieza el día, y por eso se abre en
 * **Activas**: lo que hay que preparar. Las otras solapas son consulta.
 *
 * El estado del listado —solapa, búsqueda, origen, rango de fechas y página—
 * vive en la URL y no en el cliente (§10.2): así se comparte, funciona el
 * botón atrás, y el dashboard de F7.8 y el email E4 pueden enlazar a una
 * vista concreta sin que esta pantalla se entere.
 */
export default async function OrdenesDelPanel({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltros(await searchParams);

  // Las dos consultas son independientes: encadenarlas agregaría una ida a la
  // base por cada carga de la pantalla que más se usa del panel.
  const [{ ordenes, total }, conteo] = await Promise.all([
    listarOrdenesDelPanel(filtros),
    contarPorEstado(),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Una página que ya no existe —un enlace viejo, o filtrar estando en la 4—
  // lleva a la última que sí.
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  const hayOrdenes = conteo.activa + conteo.finalizada + conteo.cancelada > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Órdenes</h1>
        <p className="text-body-sm text-ink-secondary">
          Los pedidos de la tienda y los que cargues a mano, con su estado.
        </p>
      </div>

      {/* Sin una sola orden, las solapas y los filtros no tienen sobre qué
          operar: cuatro controles arriba de un cartel que dice «todavía no
          hay ninguna» son ruido, no ayuda (§8). */}
      {!hayOrdenes ? (
        <SinOrdenes />
      ) : (
        <>
          <SolapasDeEstado filtros={filtros} conteo={conteo} />
          <BarraDeFiltros filtros={filtros} total={total} />
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
