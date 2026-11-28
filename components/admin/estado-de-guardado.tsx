import { CircleCheck, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Lo que la barra de guardado dice de la pantalla (DESIGN.md, «Guardar»).
 *
 * El `<p>` está siempre, aunque no diga nada: una región `aria-live` que
 * aparece junto con su texto no se anuncia.
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
