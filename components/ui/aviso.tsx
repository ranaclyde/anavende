"use client";

import { toast } from "sonner";

/**
 * Avisos flotantes (DR §6.15). Confirman, no reportan errores: el error se
 * muestra donde estuvo la acción. Y solo cuando lo que pasó no se ve.
 */

/** Salió como se pidió. */
export function avisar(texto: string) {
  toast.success(texto);
}

/**
 * Salió, pero no como se pidió: «Borrar» que desactiva porque el producto
 * está en una orden (RF-15).
 */
export function avisarConPero(texto: string) {
  toast.warning(texto);
}

/**
 * Hubo un despliegue con la página abierta: las Server Actions del build
 * anterior ya no existen y el próximo «Guardar» falla. Por eso no se va sola
 * ni se puede cerrar. El `id` fijo evita que se apilen dos.
 */
export function avisarVersionNueva() {
  toast.warning("Se actualizó AnaVende", {
    id: "version-nueva",
    description: "Recargá la página para seguir.",
    duration: Infinity,
    dismissible: false,
    action: {
      label: "Recargar",
      onClick: () => window.location.reload(),
    },
  });
}
