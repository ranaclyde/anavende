"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  RangoDeFechas,
  ContadorDeResultados,
} from "@/components/admin/filtros";
import { tramo } from "@/components/admin/paginacion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  FILTROS_VACIOS,
  REPOSICIONES,
  hayFiltros,
  urlDeFiltros,
  type FiltrosDeDevoluciones,
} from "@/modules/returns/filtros";

/**
 * Sin búsqueda por texto, a propósito: a una devolución se llega por su orden.
 */
export function BarraDeFiltros({
  filtros,
  total,
  porPagina,
}: {
  filtros: FiltrosDeDevoluciones;
  /** Cuántas hay con estos filtros, no cuántas entran en esta página. */
  total: number;
  porPagina: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  // Cualquier cambio vuelve a la página 1: quedarse en la 4 da una tabla vacía.
  const aplicar = (cambios: Partial<FiltrosDeDevoluciones>) =>
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Select
          aria-label="Filtrar por reposición de stock"
          value={filtros.reposicion}
          onChange={(e) =>
            aplicar({
              reposicion: e.target.value as FiltrosDeDevoluciones["reposicion"],
            })
          }
          className="md:w-48"
        >
          {REPOSICIONES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Select>

        <RangoDeFechas
          desde={filtros.desde}
          hasta={filtros.hasta}
          alCambiar={aplicar}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Se anuncia a lectores de pantalla (§9). */}
        <ContadorDeResultados pendiente={pendiente}>
          {tramo({
            pagina: filtros.pagina,
            porPagina,
            total,
            cosa: { singular: "devolución", plural: "devoluciones" },
          })}
        </ContadorDeResultados>
        {hayFiltros(filtros) ? (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() =>
              iniciar(() => router.push(urlDeFiltros(FILTROS_VACIOS)))
            }
          >
            Limpiar todo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
