"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import {
  BuscadorDelPanel,
  ContadorDeResultados,
} from "@/components/admin/filtros";
import { tramo } from "@/components/admin/paginacion";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  SelectorConBuscador,
  type OpcionDelSelector,
} from "@/components/ui/selector-con-buscador";
import {
  DIRECCION_NATURAL,
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
 * Todo vive en la URL. La navegación va en una transición para que React deje
 * la tabla anterior a la vista mientras llega la nueva, en vez de vaciarla.
 */
export function BarraDeFiltros({
  filtros,
  marcas,
  categorias,
  mostrados,
  total,
  porPagina,
}: {
  filtros: FiltrosDeProductos;
  marcas: OpcionDeCatalogo[];
  categorias: OpcionDeCatalogo[];
  mostrados: number;
  total: number;
  porPagina: number;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState(filtros.q);
  const idOrden = useId();

  // Todo cambio vuelve a la página 1: la 3 puede quedar vacía al filtrar.
  const aplicar = (cambios: Partial<FiltrosDeProductos>) => {
    iniciar(() =>
      router.push(urlDeFiltros({ ...filtros, ...cambios, pagina: 1 })),
    );
  };

  const buscar = (q: string) => aplicar({ q });

  const limpiarTodo = () => {
    setTexto("");
    iniciar(() => router.push(urlDeFiltros(sinFiltros(filtros))));
  };

  // Un criterio nuevo arranca por su dirección natural, no hereda la anterior.
  const cambiarOrden = (orden: OrdenDeProductos) =>
    aplicar({ orden, dir: DIRECCION_NATURAL[orden] });

  const filtrado = hayFiltros(filtros);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <BuscadorDelPanel
          etiqueta="Buscar productos por nombre, marca o descripción"
          marcador="Buscar por nombre, marca o descripción…"
          texto={texto}
          alEscribir={setTexto}
          alBuscar={buscar}
        />

        {/* En el teléfono, dos columnas: apilados dejan la tabla afuera. */}
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
          <SelectorConBuscador
            aria-label="Filtrar por categoría"
            valor={filtros.categoria}
            alCambiar={(categoria) => aplicar({ categoria })}
            opciones={conTodas("Todas las categorías", categorias)}
            marcador="Todas las categorías"
            buscar="Buscar una categoría…"
            sinResultados="No hay ninguna categoría con ese nombre."
            className="md:w-48"
          />

          <SelectorConBuscador
            aria-label="Filtrar por marca"
            valor={filtros.marca}
            alCambiar={(marca) => aplicar({ marca })}
            opciones={conTodas("Todas las marcas", marcas)}
            marcador="Todas las marcas"
            buscar="Buscar una marca…"
            sinResultados="No hay ninguna marca con ese nombre."
            className="md:w-48"
          />

          {/* El `div` es por la grilla: `Select` envuelve al `<select>` en un
              `div` propio, y su `className` cae en el control. */}
          <div className="col-span-2 md:col-span-1">
            <Select
              aria-label="Filtrar por stock"
              value={filtros.stock}
              onChange={(e) =>
                aplicar({
                  stock: e.target.value as FiltrosDeProductos["stock"],
                })
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          {/* Se anuncia: quien no ve la tabla se entera igual. */}
          <ContadorDeResultados pendiente={pendiente}>
            {/* «Del 1 al 40 de 52 productos», «3 de 52…» o «52…». */}
            {mostrados > porPagina
              ? tramo({
                  pagina: filtros.pagina,
                  porPagina,
                  total: mostrados,
                  cosa: { singular: "producto", plural: "productos" },
                })
              : filtrado
                ? `${mostrados} de ${cuantos(total)}`
                : cuantos(total)}
          </ContadorDeResultados>
          {filtrado ? (
            <Button variant="tertiary" size="sm" onClick={limpiarTodo}>
              Limpiar todo
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor={`${idOrden}-orden`}
            className="text-body-sm text-ink-secondary"
          >
            Ordenar por
          </label>
          <Select
            id={`${idOrden}-orden`}
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
          {/* «Destacados» es una bandera, no una escala: darla vuelta pondría
              arriba lo no destacado. */}
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

/** Las inactivas quedan: filtrar por ellas encuentra productos inactivos. */
function conTodas(
  todas: string,
  opciones: OpcionDeCatalogo[],
): OpcionDelSelector[] {
  return [
    { valor: "", etiqueta: todas },
    ...opciones.map((o) => ({
      valor: o.id,
      etiqueta: o.name,
      nota: o.isActive ? undefined : "inactiva",
    })),
  ];
}
