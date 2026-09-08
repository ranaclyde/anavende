"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Select } from "@/components/ui/select";
import {
  ORDENES_DE_TIENDA,
  urlCambiando,
  type FiltrosDeTienda,
  type OrdenDeTienda,
} from "@/modules/catalog/products/filtros-tienda";

/**
 * El orden del catálogo — §7.2 («desplegable arriba a la derecha, junto al
 * conteo de resultados»).
 *
 * **Es la única isla de cliente de esta pantalla.** Todo lo demás —filtros,
 * chips, paginación— son enlaces, y por eso funcionan sin JavaScript, se
 * pueden abrir en otra pestaña y el navegador los precarga al pasar por
 * encima. Acá hace falta cliente porque un `<select>` no navega solo.
 *
 * El control es el `Select` de §12.2, no un `<select>` con clases propias:
 * ya trae la píldora de la tienda, el radio del panel, el anillo de foco y el
 * ícono. Escribirlo de nuevo acá sería una segunda definición de lo mismo que
 * hay que acordarse de cambiar cuando cambien los tokens.
 */
export function SelectorDeOrden({ filtros }: { filtros: FiltrosDeTienda }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-secondary">
      <span className="shrink-0">Ordenar por</span>
      <Select
        value={filtros.orden}
        disabled={pendiente}
        onChange={(e) => {
          // `startTransition` deja la lista vieja en pantalla mientras llega la
          // nueva, en vez de vaciarla. Sin esto, cambiar el orden parpadea a
          // blanco y se siente más lento de lo que es.
          iniciar(() => {
            router.push(
              urlCambiando(filtros, { orden: e.target.value as OrdenDeTienda }),
            );
          });
        }}
        // Ancho fijo: con `w-auto` el control se encoge y se estira según el
        // largo de la opción elegida, y la barra entera se mueve al ordenar.
        // 48px de alto para que empate con el buscador y el botón de filtros:
        // tres controles de distinta altura en una fila se leen como un error.
        className="h-12 w-[186px] text-body-sm"
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
