"use client";

import type { Config, Driver, DriveStep, PopoverDOM } from "driver.js";
import { CircleHelp } from "lucide-react";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Ayuda guiada — FS RF-36 y RF-37. Tareas F6.6 (la tienda) y F6.7 (el panel).
 *
 * Un recorrido corto con Driver.js: oscurece la página, resalta un elemento y
 * explica en un globo qué es. **Aparece solo la primera vez** que se entra a
 * la pantalla y después se reabre con «Ver la guía», que es este mismo botón.
 *
 * **Lo visto se anota en el navegador y no en la base** (decisión del
 * 2026-10-22, anotada en `sdd/ayudas-guiadas/DEFINICION.md`): la ficha la mira
 * sobre todo quien no tiene cuenta, y un solo mecanismo para todos vale más
 * que no repetirla en un segundo dispositivo. Si el almacenamiento no
 * funciona —navegación privada, bloqueado— **no se abre sola**: sin poder
 * anotarla aparecería en cada visita, que es peor que no aparecer.
 *
 * **Los pasos se buscan por `data-ayuda`**, no por clases ni ids: el
 * atributo dice para qué está y nadie lo borra por estética. Un paso cuyo
 * elemento no está en pantalla no se arma; si el que falta es obligatorio,
 * el recorrido entero espera a una visita en la que esté.
 *
 * **Cada paso señala el primer elemento visible con su `data-ayuda`.** En el
 * panel el atributo va en todas las copias —cada renglón de una orden, cada
 * color de un producto—, y una misma pieza puede estar dos veces, una para
 * cada ancho: la orden se dibuja como tabla en escritorio y como lista en el
 * teléfono, y la que está oculta viene primero.
 *
 * **En el panel el globo lleva su escala** (F6.7). Driver.js lo pinta en el
 * `<body>`, fuera de `data-scale="admin"`, igual que los diálogos (ver
 * `escala.tsx`): sin el atributo, sus botones tomaban las medidas de la
 * tienda. El modo oscuro llega solo, porque `data-theme` está en `<html>`.
 *
 * **La librería se pide recién al abrir** (`import()`): quien ya la vio no
 * la descarga. Y **su CSS no se importa**: sin capa, ganaría a las utilidades
 * de Tailwind; el globo se dibuja en `globals.css` y con `buttonVariants`.
 */

export type PasoDeAyuda = {
  /** Valor del `data-ayuda` del elemento que se resalta. */
  elemento: string;
  titulo: string;
  texto: string;
  /** Si falta en pantalla, se saltea en vez de frenar el recorrido. */
  opcional?: boolean;
};

const CLAVE = "anavende:ayudas:v1";

function leerVistas(): string[] | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return [];
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor)
      ? valor.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return null;
  }
}

function marcarVista(id: string): void {
  const vistas = leerVistas();
  if (vistas === null || vistas.includes(id)) return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify([...vistas, id]));
  } catch {
    // Sin almacenamiento no hay dónde anotarla, y no se abre sola (arriba).
  }
}

function buscar(paso: PasoDeAyuda): Element | null {
  const elementos = document.querySelectorAll(
    `[data-ayuda="${paso.elemento}"]`,
  );
  // Un elemento oculto —`display: none`, el del otro ancho— no tiene cajas.
  for (const elemento of elementos) {
    if (elemento.getClientRects().length > 0) return elemento;
  }
  return null;
}

/** Los pasos que se pueden mostrar hoy, o `null` si falta uno obligatorio. */
function armarPasos(pasos: PasoDeAyuda[]): DriveStep[] | null {
  const armados: DriveStep[] = [];
  for (const paso of pasos) {
    const elemento = buscar(paso);
    if (!elemento) {
      if (paso.opcional) continue;
      return null;
    }
    armados.push({
      element: elemento,
      popover: { title: paso.titulo, description: paso.texto },
    });
  }
  return armados.length > 0 ? armados : null;
}

const CRUZ =
  '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/**
 * Viste el globo: botones de la tienda y la semántica que le falta.
 *
 * Driver.js los crea en cada paso, así que se visten en cada paso. El foco va
 * a «Siguiente» y no a la cruz, que es donde lo deja la librería: lo primero
 * que se anuncia tiene que ser el recorrido, no la salida. Va diferido porque
 * la librería enfoca DESPUÉS de este gancho y lo pisaría.
 */
function vestir(globo: PopoverDOM, escala: "admin" | undefined): void {
  globo.wrapper.setAttribute("aria-modal", "true");
  if (escala) globo.wrapper.setAttribute("data-scale", escala);
  // Driver.js arma el título con `<header>` y el pie con `<footer>`, y fuera
  // de una sección eso son las regiones «banner» y «contentinfo» de la
  // página: un lector de pantalla las listaría junto al encabezado del sitio.
  globo.title.setAttribute("role", "heading");
  globo.title.setAttribute("aria-level", "2");
  globo.footer.setAttribute("role", "none");
  globo.nextButton.className = cn(
    globo.nextButton.className,
    buttonVariants({ variant: "brand", size: "md" }),
  );
  globo.previousButton.className = cn(
    globo.previousButton.className,
    buttonVariants({ variant: "tertiary", size: "md" }),
  );
  // `absolute` acá y no en `globals.css`: el `relative` de la variante es
  // una utilidad y le ganaría a la capa de componentes.
  globo.closeButton.className = cn(
    globo.closeButton.className,
    buttonVariants({ variant: "tertiary", size: "icon" }),
    "absolute top-2 right-2",
  );
  globo.closeButton.innerHTML = CRUZ;
  setTimeout(() => globo.nextButton.focus());
}

export function AyudaGuiada({
  id,
  pasos,
  tamano = "md",
  className,
}: {
  /** Una por pantalla: es lo que se anota como vista. */
  id: string;
  pasos: PasoDeAyuda[];
  /** `sm` en el encabezado del panel, al lado de sus otras acciones. */
  tamano?: "sm" | "md";
  className?: string;
}) {
  const escala = useDataScale();
  const boton = useRef<HTMLButtonElement>(null);
  const activo = useRef<Driver | null>(null);
  // El `import()` tarda: sin esto, dos llamadas seguidas —el doble efecto de
  // desarrollo, o un doble toque— abrirían dos recorridos superpuestos.
  const abriendo = useRef(false);
  // Y si se fue de la pantalla mientras llegaba, no se abre en la siguiente.
  const montado = useRef(false);

  async function abrir() {
    if (abriendo.current || activo.current?.isActive()) return;
    const steps = armarPasos(pasos);
    if (!steps) return;

    abriendo.current = true;
    const { driver } = await import("driver.js").finally(() => {
      abriendo.current = false;
    });
    if (!montado.current) return;
    const quieto = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const config: Config = {
      steps,
      animate: !quieto,
      // Sin desplazamiento suave, ni siquiera con movimiento: Driver.js ubica
      // el globo antes de que termine de desplazarse, y en el teléfono un paso
      // que estaba fuera de pantalla lo dejaba pegado al borde de abajo, lejos
      // de lo que señala (probado con la 1.9.0).
      smoothScroll: false,
      overlayColor: "rgb(17 16 16)",
      overlayOpacity: 0.55,
      stagePadding: 8,
      // El radio de lo resaltado sigue al de sus piezas: píldoras y tarjetas
      // de 20 a 28px en la tienda, controles y tarjetas de 8 a 12 en el panel.
      stageRadius: escala ? 12 : 20,
      popoverClass: "ayuda-guiada",
      // Que un toque en lo resaltado no navegue a mitad del recorrido.
      disableActiveInteraction: true,
      showProgress: steps.length > 1,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Listo",
      closeBtnLabel: "Cerrar la guía",
      onPopoverRender: (globo) => vestir(globo, escala),
      // El foco vuelve al botón que la reabre; diferido por lo mismo que en
      // `vestir`.
      onDestroyed: () => {
        activo.current = null;
        setTimeout(() => boton.current?.focus());
      },
    };

    activo.current = driver(config);
    activo.current.drive();
    // **Mostrada es vista**, y no al cerrarla: quien la cierra en el primer
    // paso no quiere verla de nuevo, y Driver.js no avisa el cierre si llega
    // durante el fundido de entrada (probado con la 1.9.0: Esc a los pocos
    // milisegundos la cierra sin llamar a `onDestroyed`).
    marcarVista(id);
  }

  useEffect(() => {
    montado.current = true;
    const vistas = leerVistas();
    if (vistas !== null && !vistas.includes(id)) void abrir();
    return () => {
      montado.current = false;
      activo.current?.destroy();
    };
    // Una sola vez por montaje: `pasos` cambia de identidad en cada render
    // del padre y volvería a abrirla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <button
      ref={boton}
      type="button"
      onClick={() => void abrir()}
      className={cn(
        buttonVariants({ variant: "tertiary", size: tamano }),
        className,
      )}
    >
      <CircleHelp aria-hidden />
      Ver la guía
    </button>
  );
}
