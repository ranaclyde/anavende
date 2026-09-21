"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BuscadorDelPanel,
  RangoDeFechas,
  ContadorDeResultados,
} from "@/components/admin/filtros";
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

/**
 * Qué fecha recorta el rango en cada solapa — F7.8. La regla vive en
 * `queries-panel.ts`; esto es cómo se dice.
 */
const FECHA_DE_LA_SOLAPA: Record<Solapa, string> = {
  activas: "fecha de carga",
  finalizadas: "fecha de entrega",
  canceladas: "fecha de cancelación",
  todas: "fecha de carga",
};

/**
 * Búsqueda, origen y rango de fechas del listado de órdenes — RF-21, §10.2.
 * Tarea F7.1.
 *
 * Todo se escribe en la URL: la barra no guarda nada. Lo que se ve es lo que
 * dice la dirección, así que compartir la pantalla es copiar el enlace y el
 * botón atrás deshace un filtro en vez de salir de la pantalla.
 *
 * La navegación va dentro de una transición: React deja la tabla anterior a
 * la vista mientras llega la nueva en lugar de vaciarla, y el contador dice
 * que está buscando.
 *
 * **Cualquier cambio vuelve a la página 1.** Filtrar estando en la página 4 y
 * quedarse ahí es el camino corto a una tabla vacía que parece un error.
 */
export function BarraDeFiltros({
  filtros,
  total,
}: {
  filtros: FiltrosDeOrdenes;
  /** Cuántas hay con estos filtros, no cuántas entran en esta página. */
  total: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);

  const aplicar = (cambios: Partial<FiltrosDeOrdenes>) => {
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );
  };

  // Lo llama el buscador con el texto ya recortado, y también con la cadena
  // vacía cuando se limpia: para la barra son la misma operación.
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
        {/* El resultado se anuncia: quien no ve la tabla tiene que enterarse
            igual de cuántas quedaron (§9). */}
        <ContadorDeResultados pendiente={pendiente}>
          {cuantas(total)}
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

function cuantas(n: number): string {
  return n === 1 ? "1 orden" : `${n} órdenes`;
}
