"use client";

import type { Config, Driver, DriveStep, PopoverDOM } from "driver.js";
import { CircleHelp } from "lucide-react";
import { useEffect, useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useDataScale } from "@/components/ui/escala";
import { cn } from "@/lib/utils";

/**
 * Ayuda guiada con Driver.js (RF-36, RF-37): se abre sola la primera vez y
 * después con este botón. Lo visto se anota en `localStorage`; si no anda, no
 * se abre sola, o aparecería en cada visita.
 *
 * Si falta un paso obligatorio, el recorrido espera a otra visita. Cada paso
 * señala el primer `data-ayuda` visible: una pieza puede estar dos veces, una
 * por ancho, y la oculta viene primero.
 *
 * Su CSS no se importa: sin capa les ganaría a las utilidades de Tailwind; el
 * globo se dibuja en `globals.css`.
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
 * Driver.js recrea el globo en cada paso. El foco va a «Siguiente» y no a la
 * cruz, diferido porque la librería enfoca después de este gancho.
 */
function vestir(globo: PopoverDOM, escala: "admin" | undefined): void {
  globo.wrapper.setAttribute("aria-modal", "true");
  if (escala) globo.wrapper.setAttribute("data-scale", escala);
  // `<header>` y `<footer>` sueltos son las regiones «banner» y «contentinfo»
  // de la página para un lector de pantalla.
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
  // Driver.js les pone `display: block` en línea, que le gana a `inline-flex`.
  // Solo se borra el `block`; el `none` de un botón que no va se respeta.
  for (const boton of [
    globo.closeButton,
    globo.nextButton,
    globo.previousButton,
  ]) {
    if (boton.style.display === "block") boton.style.removeProperty("display");
  }
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
  // El `import()` tarda: sin esto, un doble toque abriría dos recorridos.
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
      // Driver.js ubica el globo antes de que termine el desplazamiento suave,
      // y queda lejos de lo que señala.
      smoothScroll: false,
      overlayColor: "rgb(17 16 16)",
      overlayOpacity: 0.55,
      stagePadding: 8,
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
      // El foco vuelve al botón; diferido, como en `vestir`.
      onDestroyed: () => {
        activo.current = null;
        setTimeout(() => boton.current?.focus());
      },
    };

    activo.current = driver(config);
    activo.current.drive();
    // Mostrada es vista, y no al cerrarla: Driver.js no llama a `onDestroyed`
    // si se cierra durante el fundido de entrada.
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
    // `pasos` cambia de identidad en cada render del padre y volvería a abrirla.
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
      Ayuda
    </button>
  );
}
