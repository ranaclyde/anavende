"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ORIGENES,
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";

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
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  const aplicar = (cambios: Partial<FiltrosDeOrdenes>) => {
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    aplicar({ q: texto.trim() });
  };

  const limpiarBusqueda = () => {
    setTexto("");
    campo.current?.focus();
    aplicar({ q: "" });
  };

  const limpiarTodo = () => {
    setTexto("");
    iniciar(() => router.push(urlDeFiltros(sinFiltros(filtros))));
  };

  const filtrado = hayFiltros(filtros);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        {/* El formulario envuelve la búsqueda y nada más: `role="search"`
            alrededor de los filtros los anunciaría como parte del buscador,
            que es justo lo que no son. */}
        <form
          role="search"
          onSubmit={buscar}
          className="relative min-w-0 flex-1 md:min-w-64"
        >
          <label htmlFor={id} className="sr-only">
            Buscar por número de orden, nombre o email del comprador
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
          />
          <Input
            id={id}
            ref={campo}
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por número, nombre o email…"
            className={cn(
              // El `admin:` de Input pisa un `pl-*` suelto —misma
              // especificidad, y las variantes van después—, así que el hueco
              // del ícono se pide también en la escala del panel.
              "pl-9 admin:pl-9",
              texto ? "pr-10 admin:pr-10" : "",
              // El navegador dibuja su propia cruz en type=search: se retira,
              // porque acá la limpieza es un botón propio y accesible.
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {texto === "" ? null : (
            <button
              type="button"
              onClick={limpiarBusqueda}
              className={cn(
                "absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center",
                "rounded-panel-control text-ink-tertiary transition-colors duration-150",
                "hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Limpiar la búsqueda</span>
            </button>
          )}

          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

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

        {/* Las dos fechas van rotuladas «Desde» y «Hasta»: un campo de fecha
            suelto no dice cuál de las dos puntas es.

            En el teléfono se apilan, y no es un gusto: un campo de fecha
            nativo no baja de unos 130px, y dos con sus rótulos en una línea
            de 390px desbordaban la pantalla 156px hacia la derecha. Lo
            encontró el repaso con Playwright. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <label
              htmlFor={`${id}-desde`}
              className="shrink-0 text-body-sm text-ink-secondary"
            >
              Desde
            </label>
            <Input
              id={`${id}-desde`}
              type="date"
              value={filtros.desde}
              // El navegador manda `""` cuando se borra la fecha, que es
              // exactamente el valor de «sin filtro»: no hace falta un botón.
              onChange={(e) => aplicar({ desde: e.target.value })}
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
            />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <label
              htmlFor={`${id}-hasta`}
              className="shrink-0 text-body-sm text-ink-secondary"
            >
              Hasta
            </label>
            <Input
              id={`${id}-hasta`}
              type="date"
              value={filtros.hasta}
              onChange={(e) => aplicar({ hasta: e.target.value })}
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* El resultado se anuncia: quien no ve la tabla tiene que enterarse
            igual de cuántas quedaron (§9). */}
        <p
          aria-live="polite"
          className={cn(
            "text-body-sm text-ink-secondary transition-opacity duration-150",
            pendiente ? "opacity-60" : "",
          )}
        >
          {pendiente ? "Buscando…" : cuantas(total)}
        </p>
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
