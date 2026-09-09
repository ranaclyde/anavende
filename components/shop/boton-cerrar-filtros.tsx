"use client";

import { X } from "lucide-react";

/**
 * La × de la hoja de filtros — §7.2, solo teléfono.
 *
 * Hermana de `BotonVerResultados` y por el mismo motivo: un `<details>`
 * nativo no se cierra desde adentro sin script. En escritorio el panel es un
 * desplegable y se cierra volviendo a tocar «Filtros», que está justo arriba;
 * en teléfono la hoja tapa la pantalla entera y ese botón queda debajo, así
 * que sin esta × no habría forma de salir sin elegir nada.
 *
 * **Las dos salidas dicen cosas distintas y las dos hacen falta.** «Ver N
 * productos» abajo es la de quien terminó de filtrar; esta es la de quien
 * abrió para mirar y se arrepintió. Ninguna de las dos descarta lo elegido:
 * cada chip ya navegó al tocarse, así que cerrar por acá deja los filtros
 * puestos y a la vista en los chips de arriba de la grilla.
 *
 * No lleva estado: busca su propio `<details>` en el DOM y le saca el
 * atributo. Por eso el panel entero sigue siendo servidor — la isla es este
 * botón, no la hoja.
 */
export function BotonCerrarFiltros() {
  return (
    <button
      type="button"
      onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
      className="grid size-11 shrink-0 place-items-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
    >
      <X aria-hidden className="size-5" />
      <span className="sr-only">Cerrar los filtros</span>
    </button>
  );
}
