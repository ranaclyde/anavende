"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Avisos flotantes — DR §6.15, §8.
 *
 * **Confirman, no reportan errores.** Un error necesita decir qué pasó y qué
 * hacer, y a veces ofrecer reintentar (§8); nada de eso entra en algo que se
 * va solo a los cuatro segundos. Los errores se quedan donde estuvo la
 * acción: el diálogo que falla no se cierra y lo muestra adentro. Por eso acá
 * hay un solo tono y no hay variantes.
 *
 * **Cuándo va uno y cuándo no.** Flotante cuando el lugar donde pasó la cosa
 * desaparece —un diálogo que se cierra, una fila que se borra— o cuando la
 * pantalla no cambia de forma visible. En su lugar, cuando lo que pasó se ve:
 * subir una foto la hace aparecer, y un aviso que diga «subimos la foto» al
 * lado de la foto es ruido.
 *
 * **No hay proveedor ni contexto.** El estado vive en este módulo y se lee con
 * `useSyncExternalStore`, así que `avisar()` se puede llamar desde cualquier
 * componente de cliente sin envolver el árbol y sin repintarlo. También es lo
 * que hace que un aviso **sobreviva a una navegación**: crear un producto
 * empuja a otra pantalla, y la confirmación tiene que llegar ahí, no morir con
 * el formulario que la disparó.
 */

export type AvisoFlotante = { id: number; texto: string };

/** Cuatro segundos: alcanza para leer un renglón y no se hace esperar. */
const DURACION = 4000;

/**
 * Tres a la vez. Más no se leen, y el cuarto empujaría al primero fuera de la
 * pantalla antes de que nadie lo mire. Se cae el más viejo, no el más nuevo.
 */
const MAXIMO = 3;

let avisos: readonly AvisoFlotante[] = [];
const oyentes = new Set<() => void>();
let ultimoId = 0;

/** Estable entre llamadas: `useSyncExternalStore` compara por identidad. */
const VACIO: readonly AvisoFlotante[] = [];

function publicar(nuevos: readonly AvisoFlotante[]) {
  avisos = nuevos;
  for (const oyente of oyentes) oyente();
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function cerrar(id: number) {
  publicar(avisos.filter((a) => a.id !== id));
}

/** Muestra un aviso. Se puede llamar desde cualquier componente de cliente. */
export function avisar(texto: string) {
  ultimoId += 1;
  publicar([...avisos, { id: ultimoId, texto }].slice(-MAXIMO));
}

/**
 * La región, una sola y siempre en el DOM. Tiene que estar desde el principio:
 * un `aria-live` que aparece junto con su contenido no se anuncia, porque el
 * lector de pantalla no llegó a registrarlo.
 */
export function AvisosFlotantes() {
  const lista = useSyncExternalStore(
    suscribir,
    () => avisos,
    () => VACIO,
  );

  return (
    <div
      aria-live="polite"
      // `z-60`, un escalón por encima del 50 de los diálogos, y es el único
      // lugar del proyecto que lo pasa. El momento en que un aviso y un
      // diálogo conviven es justo el que importa: crear un producto avisa y
      // aterriza con «Agregar color» abierto. A la misma altura ganaba la
      // capa oscura —está después en el DOM, porque sale por un portal—, y
      // medido con `elementFromPoint` el aviso quedaba debajo: atenuado y
      // con su × sin poder tocarse.
      //
      // `pointer-events-none` en la capa, porque si no taparía los clics de
      // media pantalla aun estando vacía; cada aviso se los devuelve para sí.
      className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col-reverse gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      {lista.map((aviso) => (
        <Aviso key={aviso.id} aviso={aviso} />
      ))}
    </div>
  );
}

function Aviso({ aviso }: { aviso: AvisoFlotante }) {
  // Mientras el puntero está encima o el foco adentro, el reloj no corre: que
  // un aviso se vaya justo cuando lo estabas leyendo es peor que no tenerlo.
  const [detenido, setDetenido] = useState(false);

  useEffect(() => {
    if (detenido) return;
    const reloj = setTimeout(() => cerrar(aviso.id), DURACION);
    return () => clearTimeout(reloj);
  }, [aviso.id, detenido]);

  return (
    <div
      onMouseEnter={() => setDetenido(true)}
      onMouseLeave={() => setDetenido(false)}
      onFocusCapture={() => setDetenido(true)}
      onBlurCapture={() => setDetenido(false)}
      className={[
        "pointer-events-auto flex items-start gap-3 rounded-panel-card border border-border",
        "bg-surface p-3 text-body-sm text-ink shadow-lg",
        // El mismo vocabulario que los diálogos, y apagado bajo
        // `prefers-reduced-motion` como pide §8.
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
      ].join(" ")}
    >
      {/* El ícono acompaña al texto, no lo reemplaza: §9 no admite que el
          color —ni la forma— sea lo único que dice qué pasó. */}
      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
      <p className="min-w-0 flex-1">{aviso.texto}</p>
      <button
        type="button"
        onClick={() => cerrar(aviso.id)}
        className="-my-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink sm:size-8"
      >
        <X aria-hidden className="size-4" />
        <span className="sr-only">Cerrar el aviso</span>
      </button>
    </div>
  );
}
