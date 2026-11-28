"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { RangoDeFechas } from "@/components/admin/filtros";
import { SolapasDelPanel } from "@/components/admin/solapas";
import { ATAJOS, urlDePeriodo, type Periodo } from "@/modules/reports/periodo";

/**
 * «Personalizado» (RF-28) no es un atajo más: es tocar las fechas, que están
 * siempre a la vista y dicen el rango de cualquier atajo.
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
          // Un campo vaciado no cambia el período: volver a «este mes» sin
          // pedirlo sería peor que no hacer nada.
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
