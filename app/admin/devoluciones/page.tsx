import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { BarraDeFiltros } from "@/components/admin/devoluciones/filtros";
import {
  ListadoDeDevoluciones,
  SinDevoluciones,
} from "@/components/admin/devoluciones/listado";
import { PaginacionDelPanel } from "@/components/admin/paginacion";
import { SolapasDelPanel } from "@/components/admin/solapas";
import { AyudaGuiada, type PasoDeAyuda } from "@/components/ui/ayuda-guiada";
import {
  ESTADOS,
  POR_PAGINA,
  leerFiltros,
  urlDeFiltros,
  type ParametrosDeBusqueda,
} from "@/modules/returns/filtros";
import {
  contarDevolucionesPorEstado,
  listarDevoluciones,
} from "@/modules/returns/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Devoluciones" };

/**
 * La guía de devoluciones (F6.7, RF-37), con al menos una cargada: sin
 * ninguna, el estado vacío ya dice dónde se registran. «Anular» es opcional
 * porque una anulada no lo tiene, y puede no quedar ninguna vigente en la
 * página.
 */
const PASOS_DE_DEVOLUCIONES: PasoDeAyuda[] = [
  {
    elemento: "orden-de-la-devolucion",
    titulo: "Cada una con su orden",
    texto:
      "Se cargan desde la orden finalizada, con «Registrar devolución». Tocá el número para ir a ella.",
  },
  {
    elemento: "stock-de-la-devolucion",
    titulo: "¿Volvió o no?",
    texto:
      "Las dos se descuentan de las ventas en Reportes. La diferencia es solo el stock.",
  },
  {
    elemento: "anular-devolucion",
    titulo: "¿Te equivocaste?",
    texto:
      "Una devolución no se edita: anulala y cargala de nuevo desde la orden.",
    opcional: true,
  },
];

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
  await exigirAdmin();

  const filtros = leerFiltros(await searchParams);

  // Independientes: encadenarlas agregaría una ida a la base por carga.
  const [{ devoluciones, total }, conteo] = await Promise.all([
    listarDevoluciones(filtros),
    contarDevolucionesPorEstado(),
  ]);
  const hayAlguna = conteo.registradas + conteo.anuladas > 0;
  const cuantasDe = {
    todas: conteo.registradas + conteo.anuladas,
    registradas: conteo.registradas,
    anuladas: conteo.anuladas,
  };

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Una página que ya no existe —un enlace viejo, o filtrar estando en la 3—
  // lleva a la última que sí.
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Devoluciones"
        bajada="Lo que volvió de las órdenes entregadas, con lo que se repuso al stock y lo que se descartó."
        acciones={
          hayAlguna ? (
            <AyudaGuiada
              id="panel-devoluciones"
              pasos={PASOS_DE_DEVOLUCIONES}
              tamano="sm"
            />
          ) : null
        }
      />

      {/* Sin una sola devolución, los filtros no tienen sobre qué operar:
          tres controles arriba de un cartel que dice «todavía no hay
          ninguna» son ruido, no ayuda (§8). */}
      {!hayAlguna ? (
        <SinDevoluciones />
      ) : (
        <>
          {/* El estado en solapas con su número, como órdenes y usuarios
              (F2.15): antes era un selector, el único listado del panel que
              lo resolvía distinto. «Todas» sigue siendo la de fábrica —que
              las anuladas se vean es una decisión de F7.5, `filtros.ts`—. */}
          <SolapasDelPanel
            etiqueta="Filtrar por estado"
            variante="segmentado"
            nombraElConteo={(n) =>
              n === 1 ? "1 devolución" : `${n} devoluciones`
            }
            solapas={ESTADOS.map(({ valor, etiqueta }) => ({
              href: urlDeFiltros({ ...filtros, estado: valor, pagina: 1 }),
              etiqueta,
              activa: filtros.estado === valor,
              cuantos: cuantasDe[valor],
            }))}
          />
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
