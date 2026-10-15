"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { RangoDeFechas } from "@/components/admin/filtros";
import { SolapasDelPanel } from "@/components/admin/solapas";
import { ATAJOS, urlDePeriodo, type Periodo } from "@/modules/reports/periodo";

/**
 * El período de los reportes — RF-28: hoy, últimos 7 días, este mes, mes
 * anterior y personalizado.
 *
 * **«Personalizado» no es un botón**: es lo que pasa al tocar las fechas. Las
 * fechas están siempre a la vista y dicen el rango que se está mirando, sea
 * de un atajo o elegido a mano; con un botón más, habría que apretarlo para
 * que aparezcan dos campos que de todos modos hacen falta para saber qué días
 * cuenta «este mes».
 *
 * Los atajos son enlaces, como las solapas de los listados: se abren en otra
 * pestaña y el botón atrás vuelve al período de antes.
 */
export function BarraDePeriodo({ periodo }: { periodo: Periodo }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  return (
    <div
      className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      aria-busy={pendiente || undefined}
    >
      <SolapasDelPanel
        etiqueta="Período"
        variante="segmentado"
        solapas={ATAJOS.map((a) => ({
          href: urlDePeriodo({ atajo: a.valor, ranking: periodo.ranking }),
          etiqueta: a.etiqueta,
          activa: periodo.atajo === a.valor,
        }))}
      />

      <RangoDeFechas
        desde={periodo.desde}
        hasta={periodo.hasta}
        alCambiar={(cambio) => {
          // Un campo vaciado a mano no cambia el período: sin una de las dos
          // fechas no hay rango, y volver a «este mes» sin pedirlo sería
          // peor que no hacer nada.
          const desde = "desde" in cambio ? cambio.desde : periodo.desde;
          const hasta = "hasta" in cambio ? cambio.hasta : periodo.hasta;
          if (!desde || !hasta) return;
          iniciar(() =>
            router.push(
              urlDePeriodo({ desde, hasta, ranking: periodo.ranking }),
            ),
          );
        }}
      />
    </div>
  );
}
