"use client";

import { useEffect } from "react";

import { avisarVersionNueva } from "@/components/ui/aviso";

/** Cada cuánto se pregunta con la pestaña a la vista. */
const CADA = 2 * 60 * 1000;

/** Volver a la pestaña dos veces seguidas no son dos preguntas. */
const RESPIRO = 15 * 1000;

/**
 * Avisa que hubo un despliegue mientras el panel estaba abierto
 * (2026-11-17, `lib/version.ts`).
 *
 * Esta página se pintó con `version`; `/api/salud` dice cuál sirve el
 * servidor ahora. Si difieren, las Server Actions de esta página ya no
 * existen y el próximo «Guardar» va a fallar: se avisa antes, con un aviso
 * que no se va hasta recargar.
 *
 * Se pregunta cada dos minutos con la pestaña a la vista y al volver a ella,
 * que es cuando más probable es que algo haya cambiado: una pestaña del panel
 * puede quedar abierta días. Oculta no pregunta. Una vez que avisó, deja de
 * preguntar: no hay nada más que averiguar.
 *
 * Sin `version` —`next dev`, o el archivo que no se pudo leer— no se arma, y
 * tampoco en desarrollo, donde cada guardado de un archivo es un build.
 */
export function AvisoDeVersion({ version }: { version: string | null }) {
  useEffect(() => {
    if (!version || process.env.NODE_ENV !== "production") return;

    let avisado = false;
    let ultima = 0;

    async function revisar() {
      if (avisado || document.visibilityState !== "visible") return;
      const ahora = Date.now();
      if (ahora - ultima < RESPIRO) return;
      ultima = ahora;

      try {
        const respuesta = await fetch("/api/salud", { cache: "no-store" });
        if (!respuesta.ok) return;
        const { version: actual } = (await respuesta.json()) as {
          version?: unknown;
        };
        // Solo una versión distinta cuenta. Un servidor que no contesta, o
        // que contesta sin versión, no dice que haya otra.
        if (typeof actual === "string" && actual !== version) {
          avisado = true;
          avisarVersionNueva();
        }
      } catch {
        // Sin red o con el servidor reiniciando: se vuelve a preguntar después.
      }
    }

    const intervalo = window.setInterval(revisar, CADA);
    document.addEventListener("visibilitychange", revisar);
    window.addEventListener("focus", revisar);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", revisar);
      window.removeEventListener("focus", revisar);
    };
  }, [version]);

  return null;
}
