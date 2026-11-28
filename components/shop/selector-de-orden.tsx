"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useAvisarFiltrando } from "@/components/shop/filtrando";
import { Select } from "@/components/ui/select";
import { TIPO_FILTRO } from "@/lib/transiciones";
import {
  ORDENES_DE_TIENDA,
  urlCambiando,
  type FiltrosDeTienda,
  type OrdenDeTienda,
} from "@/modules/catalog/products/filtros-tienda";

/** El orden del catálogo. Es cliente porque un `<select>` no navega solo. */
export function SelectorDeOrden({ filtros }: { filtros: FiltrosDeTienda }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  useAvisarFiltrando(pendiente);

  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-secondary">
      <span className="shrink-0">Ordenar por</span>
      <Select
        value={filtros.orden}
        disabled={pendiente}
        onChange={(e) => {
          // La transición deja la lista vieja en pantalla mientras llega la nueva.
          iniciar(() => {
            router.push(
              urlCambiando(filtros, { orden: e.target.value as OrdenDeTienda }),
              { transitionTypes: TIPO_FILTRO },
            );
          });
        }}
        // Ancho fijo: con `w-auto` la barra se mueve al ordenar. 16px en
        // teléfono: iOS amplía la página al abrir un `select` chico.
        className="h-12 w-[186px] text-body-sm max-md:text-body"
      >
        {ORDENES_DE_TIENDA.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </Select>
    </label>
  );
}
