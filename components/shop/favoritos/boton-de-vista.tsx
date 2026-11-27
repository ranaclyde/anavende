"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { elegirVistaDeFavoritos } from "@/modules/users/favoritos/actions";
import type { VistaDeFavoritos } from "@/modules/users/favoritos/schemas";

/**
 * Muestra la vista a la que lleva, no la actual. Si la acción falla no se dice
 * nada a propósito: la vista queda como estaba y se puede volver a probar.
 */
export function BotonDeVista({ vista }: { vista: VistaDeFavoritos }) {
  const [enCurso, iniciar] = useTransition();

  const otra = vista === "lista" ? "tarjetas" : "lista";
  const etiqueta = otra === "tarjetas" ? "Ver como tarjetas" : "Ver como lista";
  const Icono = otra === "tarjetas" ? LayoutGrid : List;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          loading={enCurso}
          loadingLabel="Cambiando la vista"
          onClick={() =>
            iniciar(async () => {
              await elegirVistaDeFavoritos({ vista: otra });
            })
          }
        >
          <Icono aria-hidden className="size-5" />
          <span className="sr-only">{etiqueta}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{etiqueta}</TooltipContent>
    </Tooltip>
  );
}
