"use client";

import { useEffect } from "react";

/**
 * Pide confirmación antes de cerrar o recargar la pestaña con cambios sin
 * guardar. El texto lo pone el navegador. No cubre los enlaces del panel, que
 * navegan sin recargar.
 */
export function useAvisoAlSalir(hayCambios: boolean): void {
  useEffect(() => {
    if (!hayCambios) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayCambios]);
}
