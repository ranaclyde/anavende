"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BuscadorDelPanel,
  RangoDeFechas,
  ContadorDeResultados,
} from "@/components/admin/filtros";
import { tramo } from "@/components/admin/paginacion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ORIGENES,
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeOrdenes,
  type Solapa,
} from "@/modules/orders/filtros-panel";

/** La regla vive en `queries-panel.ts`; esto es cómo se dice. */
const FECHA_DE_LA_SOLAPA: Record<Solapa, string> = {
  activas: "fecha de carga",
  finalizadas: "fecha de entrega",
  canceladas: "fecha de cancelación",
  todas: "fecha de carga",
};

/**
 * Todo va en la URL. Cualquier cambio vuelve a la página 1: quedarse en la 4
 * da una tabla vacía que parece un error.
 */
export function BarraDeFiltros({
  filtros,
  total,
  porPagina,
}: {
  filtros: FiltrosDeOrdenes;
  /** Cuántas hay con estos filtros, no cuántas entran en esta página. */
  total: number;
  porPagina: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);

  const aplicar = (cambios: Partial<FiltrosDeOrdenes>) => {
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );
  };

  const buscar = (q: string) => aplicar({ q });

  const limpiarTodo = () => {
    setTexto("");
    iniciar(() => router.push(urlDeFiltros(sinFiltros(filtros))));
  };

  const filtrado = hayFiltros(filtros);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <BuscadorDelPanel
          etiqueta="Buscar por número de orden, nombre o email del comprador"
          marcador="Buscar por número, nombre o email…"
          texto={texto}
          alEscribir={setTexto}
          alBuscar={buscar}
        />

        <Select
          aria-label="Filtrar por origen"
          value={filtros.origen}
          onChange={(e) =>
            aplicar({ origen: e.target.value as FiltrosDeOrdenes["origen"] })
          }
          className="md:w-44"
        >
          {ORIGENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Select>

        <RangoDeFechas
          desde={filtros.desde}
          hasta={filtros.hasta}
          alCambiar={aplicar}
          porQueFecha={FECHA_DE_LA_SOLAPA[filtros.solapa]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Se anuncia a lectores de pantalla (§9). */}
        <ContadorDeResultados pendiente={pendiente}>
          {tramo({
            pagina: filtros.pagina,
            porPagina,
            total,
            cosa: { singular: "orden", plural: "órdenes" },
          })}
        </ContadorDeResultados>
        {filtrado ? (
          <Button variant="tertiary" size="sm" onClick={limpiarTodo}>
            Limpiar todo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
