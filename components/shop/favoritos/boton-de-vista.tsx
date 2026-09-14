"use client";

import { LayoutGrid, List } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { elegirVistaDeFavoritos } from "@/modules/users/favoritos/actions";
import type { VistaDeFavoritos } from "@/modules/users/favoritos/schemas";

/**
 * Lista o tarjetas en «Favoritos» — F5.4 (pedido del 2026-09-14).
 *
 * **Un solo botón, que muestra la vista a la que lleva**: con la lista puesta
 * se ven los recuadros, y con las tarjetas, la lista. La etiqueta dice lo
 * mismo con palabras —«Ver como tarjetas»— para el lector de pantalla, y
 * como `title` para quien no reconozca el ícono.
 *
 * Si la acción falla no se dice nada: la vista queda como estaba, que es
 * todo lo que puede pasar, y el botón sigue ahí para volver a probar.
 */
export function BotonDeVista({ vista }: { vista: VistaDeFavoritos }) {
  const [enCurso, iniciar] = useTransition();

  const otra = vista === "lista" ? "tarjetas" : "lista";
  const etiqueta = otra === "tarjetas" ? "Ver como tarjetas" : "Ver como lista";
  const Icono = otra === "tarjetas" ? LayoutGrid : List;

  return (
    <Button
      variant="secondary"
      size="icon"
      title={etiqueta}
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
  );
}
