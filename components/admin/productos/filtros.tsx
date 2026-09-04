"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DIRECCION_NATURAL,
  ESTADOS,
  FILTROS_DE_STOCK,
  ORDENES,
  hayFiltros,
  sinFiltros,
  urlDeFiltros,
  type FiltrosDeProductos,
  type OrdenDeProductos,
} from "@/modules/catalog/products/filtros";
import type { OpcionDeCatalogo } from "@/modules/catalog/products/queries";

/**
 * Búsqueda, filtros y orden del listado de productos — RF-15, §10.2.
 *
 * Todo se escribe en la URL: la barra no guarda nada. Lo que se ve es
 * exactamente lo que dice la dirección, así que compartir la pantalla es
 * copiar el enlace y el botón atrás deshace un filtro en vez de salir de la
 * pantalla.
 *
 * La navegación va dentro de una transición: React deja la tabla anterior a
 * la vista mientras llega la nueva en lugar de vaciarla, y el contador dice
 * que está buscando. Un listado que parpadea a blanco en cada tecla se
 * siente más lento de lo que es.
 */
export function BarraDeFiltros({
  filtros,
  marcas,
  categorias,
  mostrados,
  total,
}: {
  filtros: FiltrosDeProductos;
  marcas: OpcionDeCatalogo[];
  categorias: OpcionDeCatalogo[];
  mostrados: number;
  total: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);
  const campo = useRef<HTMLInputElement>(null);
  const idBusqueda = useId();

  const aplicar = (cambios: Partial<FiltrosDeProductos>) => {
    iniciar(() => router.push(urlDeFiltros({ ...filtros, ...cambios })));
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

  /**
   * Cambiar de criterio arranca por su dirección natural en vez de heredar
   * la anterior: venir de «más nuevos primero» no tiene por qué dejar los
   * precios de mayor a menor.
   */
  const cambiarOrden = (orden: OrdenDeProductos) =>
    aplicar({ orden, dir: DIRECCION_NATURAL[orden] });

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
          <label htmlFor={idBusqueda} className="sr-only">
            Buscar productos por nombre, marca o descripción
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
          />
          <Input
            id={idBusqueda}
            ref={campo}
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, marca o descripción…"
            className={cn(
              // El `admin:` de Input pisa un `pl-*` suelto —misma
              // especificidad, y las variantes van después—, así que el
              // hueco del ícono se pide también en la escala del panel. Sin
              // esto la lupa se apoya sobre la primera letra.
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

          {/* Enter alcanza; el botón existe para que el formulario tenga un
              envío explícito y el lector de pantalla sepa cómo se manda. */}
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>

        {/* En el teléfono los cuatro filtros van en dos columnas: uno debajo
            del otro deja la tabla fuera de la pantalla antes de empezar. */}
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          <Select
            aria-label="Filtrar por categoría"
            value={filtros.categoria}
            onChange={(e) => aplicar({ categoria: e.target.value })}
            className="md:w-48"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.isActive ? c.name : `${c.name} (inactiva)`}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por marca"
            value={filtros.marca}
            onChange={(e) => aplicar({ marca: e.target.value })}
            className="md:w-48"
          >
            <option value="">Todas las marcas</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.isActive ? m.name : `${m.name} (inactiva)`}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por estado"
            value={filtros.estado}
            onChange={(e) =>
              aplicar({ estado: e.target.value as FiltrosDeProductos["estado"] })
            }
            className="md:w-44"
          >
            {ESTADOS.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por stock"
            value={filtros.stock}
            onChange={(e) =>
              aplicar({ stock: e.target.value as FiltrosDeProductos["stock"] })
            }
            className="md:w-40"
          >
            {FILTROS_DE_STOCK.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          {/* El resultado se anuncia: quien no ve la tabla tiene que
              enterarse igual de cuántos quedaron (§9). */}
          <p
            aria-live="polite"
            className={cn(
              "text-body-sm text-ink-secondary transition-opacity duration-150",
              pendiente ? "opacity-60" : "",
            )}
          >
            {pendiente
              ? "Buscando…"
              : filtrado
                ? `${mostrados} de ${cuantos(total)}`
                : cuantos(total)}
          </p>
          {filtrado ? (
            <Button variant="tertiary" size="sm" onClick={limpiarTodo}>
              Limpiar todo
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor={`${idBusqueda}-orden`}
            className="text-body-sm text-ink-secondary"
          >
            Ordenar por
          </label>
          <Select
            id={`${idBusqueda}-orden`}
            value={filtros.orden}
            onChange={(e) => cambiarOrden(e.target.value as OrdenDeProductos)}
            className="w-48"
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </Select>
          {/* «Destacados primero» es una bandera y no una escala: darla vuelta
              pondría arriba lo NO destacado. El botón aparece solo cuando
              puede hacer algo, en vez de quedar apagado sin explicación. */}
          {filtros.orden === "destacados" ? null : (
            <Button
              variant="secondary"
              size="icon"
              onClick={() =>
                aplicar({ dir: filtros.dir === "asc" ? "desc" : "asc" })
              }
              title={
                filtros.dir === "asc" ? "De mayor a menor" : "De menor a mayor"
              }
            >
              {filtros.dir === "asc" ? (
                <ArrowUpNarrowWide aria-hidden />
              ) : (
                <ArrowDownWideNarrow aria-hidden />
              )}
              <span className="sr-only">
                {filtros.dir === "asc"
                  ? "Ordenar de mayor a menor"
                  : "Ordenar de menor a mayor"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function cuantos(n: number): string {
  return n === 1 ? "1 producto" : `${n} productos`;
}
