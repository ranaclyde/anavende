"use client";

import { useEffect } from "react";

/**
 * Pide confirmación antes de cerrar o recargar la pestaña con cambios sin
 * guardar (F2.15). Es el aviso del navegador, el único que se puede mostrar
 * en ese momento: el texto lo pone él y no se puede cambiar.
 *
 * **No cubre los enlaces del panel**, que navegan sin recargar. Para eso
 * está el estado a la vista al lado de «Guardar»: lo que se pierde de verdad
 * sin aviso es cerrar la pestaña o recargarla por error.
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
