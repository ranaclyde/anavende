"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

const PREFIJO = "anavende:borrador:";

/**
 * Subirlo si cambian los campos: los borradores viejos se ignoran en vez de
 * reponerse a medias.
 */
const FORMATO = 1;

/**
 * Lo escrito en un formulario sobrevive a una recarga, por ejemplo la que
 * pide un despliegue. Se guarda una vez en `pagehide`, no en cada tecla, en
 * `sessionStorage` (solo esta pestaña) y se consume al leerlo. `descartar` se
 * llama al guardar bien.
 */
export function useBorrador<T>({
  clave,
  hayCambios,
  leer,
  reponer,
}: {
  /** Única por formulario y por registro: `producto:nuevo`, `producto:<id>`. */
  clave: string;
  hayCambios: boolean;
  leer: () => T;
  reponer: (datos: T) => void;
}): { recuperado: boolean; descartar: () => void } {
  const [recuperado, setRecuperado] = useState(false);
  const descartado = useRef(false);
  const llave = PREFIJO + clave;

  const alMontar = useEffectEvent(() => {
    let datos: T | null = null;
    try {
      const crudo = sessionStorage.getItem(llave);
      sessionStorage.removeItem(llave);
      const guardado = crudo
        ? (JSON.parse(crudo) as { formato?: number; datos?: T })
        : null;
      if (guardado?.formato === FORMATO && guardado.datos) {
        datos = guardado.datos;
      }
    } catch {
      // Sin almacenamiento (modo privado, bloqueado).
    }
    if (datos === null) return;
    reponer(datos);
    setRecuperado(true);
  });

  const alIrse = useEffectEvent(() => {
    try {
      if (hayCambios && !descartado.current) {
        sessionStorage.setItem(
          llave,
          JSON.stringify({ formato: FORMATO, datos: leer() }),
        );
      } else {
        sessionStorage.removeItem(llave);
      }
    } catch {
      // Lleno o bloqueado: se pierde lo escrito.
    }
  });

  // Se repone después de montar: leer `sessionStorage` en el estado inicial
  // haría que el cliente hidrate otra cosa que lo que mandó el servidor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    alMontar();
  }, [llave]);

  useEffect(() => {
    const guardar = () => alIrse();
    window.addEventListener("pagehide", guardar);
    return () => window.removeEventListener("pagehide", guardar);
  }, []);

  return {
    recuperado,
    descartar: () => {
      descartado.current = true;
      try {
        sessionStorage.removeItem(llave);
      } catch {
        // Nada que limpiar si no hay almacenamiento.
      }
    },
  };
}
