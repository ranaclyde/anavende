import Link from "next/link";

import { cn } from "@/lib/utils";
import type { EstadoOrden } from "@/modules/orders/estados";
import {
  SOLAPAS,
  urlDeFiltros,
  type FiltrosDeOrdenes,
} from "@/modules/orders/filtros-panel";

/**
 * Las solapas por estado — RF-21, DR §5.2. Tarea F7.1.
 *
 * **Son enlaces y no botones, y por eso esto no es un componente de
 * cliente.** Cada solapa tiene su propia dirección: se comparte, se abre en
 * otra pestaña y el botón atrás vuelve a la anterior. Con botones habría que
 * reimplementar las tres cosas y además mandar JavaScript al navegador para
 * algo que el navegador ya sabe hacer.
 *
 * **Llevan el número de cada estado**, que es lo que contesta «¿tengo algo
 * que hacer?» sin entrar. El conteo es del total y no del filtro puesto: si
 * cambiara con cada búsqueda, la solapa dejaría de ser un indicador para
 * pasar a ser un resultado más.
 *
 * Cambiar de solapa **conserva los filtros y vuelve a la página 1**: la
 * página 3 de las activas no tiene por qué existir entre las canceladas.
 */
export function SolapasDeEstado({
  filtros,
  conteo,
}: {
  filtros: FiltrosDeOrdenes;
  conteo: Record<EstadoOrden, number>;
}) {
  const total = conteo.activa + conteo.finalizada + conteo.cancelada;

  return (
    <nav aria-label="Filtrar por estado">
      <ul className="inline-flex flex-wrap gap-1 rounded-panel-control bg-surface-sunken p-1">
        {SOLAPAS.map(({ valor, etiqueta, estado }) => {
          const activa = filtros.solapa === valor;
          const cuantas = estado === null ? total : conteo[estado];

          return (
            <li key={valor}>
              <Link
                href={urlDeFiltros({ ...filtros, solapa: valor, pagina: 1 })}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-panel-control px-3",
                  "text-body-sm transition-colors duration-150",
                  activa
                    ? // Fondo Y peso, no sólo color: la solapa elegida no se
                      // comunica con un tono (§9).
                      "bg-surface font-medium text-ink shadow-sm"
                    : "text-ink-secondary hover:text-ink",
                )}
              >
                {etiqueta}
                <span
                  aria-hidden
                  className={cn(
                    "text-caption tabular-nums",
                    activa ? "text-ink-secondary" : "text-ink-tertiary",
                  )}
                >
                  {cuantas}
                </span>
                <span className="sr-only">
                  {cuantas === 1 ? "(1 orden)" : `(${cuantas} órdenes)`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
