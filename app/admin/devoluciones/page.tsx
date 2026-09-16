import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BarraDeFiltros } from "@/components/admin/devoluciones/filtros";
import {
  ListadoDeDevoluciones,
  SinDevoluciones,
} from "@/components/admin/devoluciones/listado";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import {
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/returns/filtros";
import {
  hayAlgunaDevolucion,
  listarDevoluciones,
} from "@/modules/returns/queries";

export const metadata: Metadata = { title: "Devoluciones" };

/**
 * Listado de devoluciones — FS RF-25. Tarea F7.5.
 *
 * Es la pantalla de consulta de RF-25: qué volvió, de qué orden, cuánto, si
 * volvió al stock y por qué. **No se registra nada desde acá**: una devolución
 * es siempre contra una orden, y se carga desde su detalle, que es donde están
 * los renglones y las cantidades.
 *
 * El estado del listado —estado, reposición, rango de fechas y página— vive en
 * la URL (§10.2), así que se comparte y el botón atrás deshace un filtro.
 */
export default async function DevolucionesDelPanel({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltros(await searchParams);

  // Independientes: encadenarlas agregaría una ida a la base por carga.
  const [{ devoluciones, total }, hayAlguna] = await Promise.all([
    listarDevoluciones(filtros),
    hayAlgunaDevolucion(),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Una página que ya no existe —un enlace viejo, o filtrar estando en la 3—
  // lleva a la última que sí.
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Devoluciones</h1>
        <p className="text-body-sm text-ink-secondary">
          Lo que volvió de las órdenes entregadas, con lo que se repuso al stock
          y lo que se descartó.
        </p>
      </div>

      {/* Sin una sola devolución, los filtros no tienen sobre qué operar:
          tres controles arriba de un cartel que dice «todavía no hay
          ninguna» son ruido, no ayuda (§8). */}
      {!hayAlguna ? (
        <SinDevoluciones />
      ) : (
        <>
          <BarraDeFiltros filtros={filtros} total={total} />
          <ListadoDeDevoluciones devoluciones={devoluciones} />
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
