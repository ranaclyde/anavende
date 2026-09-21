"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  RangoDeFechas,
  ContadorDeResultados,
} from "@/components/admin/filtros";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ESTADOS,
  FILTROS_VACIOS,
  REPOSICIONES,
  hayFiltros,
  urlDeFiltros,
  type FiltrosDeDevoluciones,
} from "@/modules/returns/filtros";

/**
 * Estado, reposición y rango de fechas del listado de devoluciones — RF-25,
 * §10.2. Tarea F7.5.
 *
 * Todo se escribe en la URL, como en el listado de órdenes: la barra no guarda
 * nada, compartir la pantalla es copiar el enlace y el botón atrás deshace un
 * filtro en vez de salir.
 *
 * **Sin búsqueda por texto, y no por olvido**: RF-25 pide filtros por fecha y
 * por reposición. A una devolución concreta se llega por su orden, que es como
 * se la busca —«la de la señora que trajo el auricular»— y ahí está, en el
 * detalle. Un buscador acá sería una segunda forma de encontrar lo mismo.
 */
export function BarraDeFiltros({
  filtros,
  total,
}: {
  filtros: FiltrosDeDevoluciones;
  /** Cuántas hay con estos filtros, no cuántas entran en esta página. */
  total: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  // Cualquier cambio vuelve a la página 1: filtrar estando en la 4 y quedarse
  // ahí es el camino corto a una tabla vacía que parece un error.
  const aplicar = (cambios: Partial<FiltrosDeDevoluciones>) =>
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <Select
          aria-label="Filtrar por estado"
          value={filtros.estado}
          onChange={(e) =>
            aplicar({
              estado: e.target.value as FiltrosDeDevoluciones["estado"],
            })
          }
          className="md:w-56"
        >
          {ESTADOS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Select>

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
        {/* El resultado se anuncia: quien no ve la lista tiene que enterarse
            igual de cuántas quedaron (§9). */}
        <ContadorDeResultados pendiente={pendiente}>
          {cuantas(total)}
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

function cuantas(n: number): string {
  return n === 1 ? "1 devolución" : `${n} devoluciones`;
}
