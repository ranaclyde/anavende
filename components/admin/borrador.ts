"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

const PREFIJO = "anavende:borrador:";

/**
 * La forma de lo guardado. Si un día cambian los campos de un formulario, se
 * sube este número y los borradores viejos se ignoran en vez de reponerse a
 * medias.
 */
const FORMATO = 1;

/**
 * Lo escrito en un formulario sobrevive a una recarga (2026-11-17).
 *
 * El caso que lo pidió: un despliegue con el formulario de producto abierto.
 * Desde ese momento «Guardar» falla —la página tiene los códigos de las
 * Server Actions del build anterior— y lo único que lo arregla es recargar,
 * que borraba todo lo cargado. Sirve igual para un F5 sin querer.
 *
 * **Se guarda al irse, no en cada tecla.** `pagehide` llega en toda recarga y
 * todo cierre, y ahí se lee el formulario una sola vez —la descripción
 * incluida, que no es estado de React—. Sin cambios, se borra lo que hubiera.
 *
 * **`sessionStorage` y no `localStorage`:** es de esta pestaña y se va al
 * cerrarla. Un borrador que reaparece días después, en otra pestaña, sería
 * más confuso que útil. Y se consume al leerlo: si después se sale por un
 * enlace sin guardar, no vuelve a aparecer la próxima vez.
 *
 * Devuelve si se repuso algo, para decirlo en pantalla, y `descartar`, que
 * se llama al guardar bien: lo guardado ya no es un borrador.
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
  /** Lo que hay en pantalla, para guardarlo. */
  leer: () => T;
  /** Pone lo guardado en pantalla. */
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
      // Sin almacenamiento (modo privado, bloqueado): no hay nada que reponer.
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
      // Lleno o bloqueado: se pierde lo escrito, como antes de esto.
    }
  });

  // Reponer después de montar es a propósito. `sessionStorage` no existe al
  // pintar en el servidor, y leerlo en el estado inicial haría que el
  // cliente hidrate otra cosa que lo que mandó el servidor. Pasa una vez, y
  // solo después de una recarga con algo escrito.
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
