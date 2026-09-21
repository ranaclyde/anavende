"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  BuscadorDelPanel,
  ContadorDeResultados,
} from "@/components/admin/filtros";
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
 * Búsqueda, rol y estado del listado de usuarios — RF-26, §10.2. Tarea F7.6.
 *
 * Todo se escribe en la URL, como en los otros listados del panel: la barra no
 * guarda nada, el enlace se comparte y el botón atrás deshace un filtro en vez
 * de salir de la pantalla.
 */
export function BarraDeFiltros({
  filtros,
  total,
}: {
  filtros: FiltrosDeUsuarios;
  /** Cuántos hay con estos filtros, no cuántos entran en esta página. */
  total: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);

  // Cualquier cambio vuelve a la página 1.
  const aplicar = (cambios: Partial<FiltrosDeUsuarios>) =>
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );

  // Lo llama el buscador con el texto ya recortado, y también con la cadena
  // vacía cuando se limpia: para la barra son la misma operación.
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
          {cuantos(total)}
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

function cuantos(n: number): string {
  return n === 1 ? "1 persona" : `${n} personas`;
}
