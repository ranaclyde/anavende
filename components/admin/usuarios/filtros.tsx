"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ESTADOS,
  FILTROS_VACIOS,
  ROLES,
  hayFiltros,
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
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  // Cualquier cambio vuelve a la página 1.
  const aplicar = (cambios: Partial<FiltrosDeUsuarios>) =>
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            aplicar({ q: texto.trim() });
          }}
          className="relative min-w-0 flex-1 md:min-w-64"
        >
          <label htmlFor={id} className="sr-only">
            Buscar por nombre o email
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
            placeholder="Buscar por nombre o email…"
            className={cn(
              "pl-9 admin:pl-9",
              texto ? "pr-10 admin:pr-10" : "",
              "[&::-webkit-search-cancel-button]:appearance-none",
            )}
          />
          {texto === "" ? null : (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                campo.current?.focus();
                aplicar({ q: "" });
              }}
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

        <Select
          aria-label="Filtrar por estado"
          value={filtros.estado}
          onChange={(e) =>
            aplicar({ estado: e.target.value as FiltrosDeUsuarios["estado"] })
          }
          className="md:w-52"
        >
          {ESTADOS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p
          aria-live="polite"
          className={cn(
            "text-body-sm text-ink-secondary transition-opacity duration-150",
            pendiente ? "opacity-60" : "",
          )}
        >
          {pendiente ? "Buscando…" : cuantos(total)}
        </p>
        {hayFiltros(filtros) ? (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              setTexto("");
              iniciar(() => router.push(urlDeFiltros(FILTROS_VACIOS)));
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
