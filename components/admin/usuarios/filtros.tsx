"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BuscadorDelPanel,
  ContadorDeResultados,
} from "@/components/admin/filtros";
import { rangeLabel } from "@/components/admin/paginacion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ROLES,
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeUsuarios,
} from "@/modules/users/panel/filtros";

/**
 * Búsqueda y rol del listado de usuarios — RF-26. El estado va en solapas
 * (`usuarios/solapas.tsx`). Todo se escribe en la URL.
 */
export function BarraDeFiltros({
  filtros,
  total,
  porPagina,
}: {
  filtros: FiltrosDeUsuarios;
  /** Cuántos hay con estos filtros, no cuántos entran en esta página. */
  total: number;
  /** Para el tramo: «Del 41 al 80 de 95». */
  porPagina: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);

  const aplicar = (cambios: Partial<FiltrosDeUsuarios>) =>
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );

  const buscar = (q: string) => aplicar({ q });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <BuscadorDelPanel
          etiqueta="Buscar por nombre o email"
          marcador="Buscar por nombre o email…"
          texto={texto}
          alEscribir={setTexto}
          alBuscar={buscar}
        />

        <Select
          aria-label="Filtrar por rol"
          value={filtros.rol}
          onChange={(e) =>
            aplicar({ rol: e.target.value as FiltrosDeUsuarios["rol"] })
          }
          className="md:w-48"
        >
          {ROLES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ContadorDeResultados pendiente={pendiente}>
          {rangeLabel({
            page: filtros.pagina,
            perPage: porPagina,
            total,
            noun: { singular: "persona", plural: "personas" },
          })}
        </ContadorDeResultados>
        {hayFiltros(filtros) ? (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              setTexto("");
              iniciar(() => router.push(urlDeFiltros(sinFiltros(filtros))));
            }}
          >
            Limpiar todo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
