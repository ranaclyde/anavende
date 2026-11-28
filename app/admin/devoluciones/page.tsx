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
  type SearchParamsRecord,
} from "@/modules/returns/filtros";
import {
  contarDevolucionesPorEstado,
  listarDevoluciones,
} from "@/modules/returns/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Devoluciones" };

/** «Anular» es opcional: puede no haber ninguna vigente en la página. */
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
 * Solo consulta (RF-25): una devolución se registra desde el detalle de su
 * orden.
 */
export default async function DevolucionesDelPanel({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const filtros = leerFiltros(await searchParams);

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
  // Una página que ya no existe lleva a la última que sí.
  if (filtros.pagina > paginas) {
    redirect(urlDeFiltros({ ...filtros, pagina: paginas }));
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo="Devoluciones"
        bajada="Las devoluciones de productos por órdenes."
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

      {/* Sin ninguna, no se muestran los filtros (§8). */}
      {!hayAlguna ? (
        <SinDevoluciones />
      ) : (
        <>
          {/* «Todas» es la de fábrica (`filtros.ts`). */}
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
          <BarraDeFiltros
            filtros={filtros}
            total={total}
            porPagina={POR_PAGINA}
          />
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
