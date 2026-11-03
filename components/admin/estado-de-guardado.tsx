import { CircleCheck, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Lo que la barra de guardado dice de la pantalla: Configuración, Legales y
 * la ficha del producto (DESIGN.md, «Guardar»).
 *
 * - `guardado`: lo que se ve es lo que está en la base. Gris, el estado
 *   normal; además explica por qué «Guardar» está apagado (§8).
 * - `sin-guardar`: se tocó algo. Ámbar, para que no se vaya nadie con el
 *   precio cambiado y sin guardar. Antes la leyenda desaparecía y la barra
 *   quedaba muda justo cuando había algo que decir.
 * - `actualizado`: se acaba de guardar y la pantalla se quedó. Verde, hasta
 *   que se vuelva a tocar algo.
 *
 * Siempre con ícono: sin él, el «Todo guardado.» gris de antes quedaba igual que el
 * «Cancelar» terciario de al lado, y no se sabía cuál era el botón
 * (2026-11-03). Va pegada a la izquierda, lejos de los botones, por lo mismo.
 *
 * El `<p>` está siempre, aunque no diga nada (`null`, un producto nuevo):
 * una región `aria-live` que aparece junto con su texto no se anuncia.
 */
export type EstadoDeGuardado = "guardado" | "sin-guardar" | "actualizado";

const LEYENDA = {
  guardado: {
    texto: "Guardado",
    Icono: CircleCheck,
    tono: "text-ink-secondary",
  },
  "sin-guardar": {
    texto: "Cambios sin guardar",
    Icono: CircleDot,
    tono: "text-warning",
  },
  actualizado: {
    texto: "Actualizado",
    Icono: CircleCheck,
    tono: "text-success",
  },
} as const;

export function EstadoDeGuardado({
  estado,
  className,
}: {
  estado: EstadoDeGuardado | null;
  className?: string;
}) {
  const leyenda = estado ? LEYENDA[estado] : null;

  return (
    <p
      aria-live="polite"
      className={cn(
        "mr-auto flex items-center gap-1.5 text-body-sm",
        leyenda?.tono,
        className,
      )}
    >
      {leyenda ? (
        <>
          <leyenda.Icono aria-hidden className="size-4 shrink-0" />
          {leyenda.texto}
        </>
      ) : null}
    </p>
  );
}
