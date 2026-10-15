"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { crearPreferencia } from "@/lib/preferencia-local";
import { cn } from "@/lib/utils";

/**
 * Modo oscuro del panel — DESIGN-REFERENCE §3.2, §5.2, §12.1.
 *
 * EL MODO OSCURO SOLO EXISTE EN /admin: la tienda es siempre clara. Por eso
 * no se usa una biblioteca de temas —todas escriben en <html> y se quedan
 * pegadas al salir del panel— sino un atributo que se pone al entrar y se
 * saca al irse.
 *
 * Se persiste en el navegador de cada persona: la vendedora elige una vez.
 */

const CLAVE = "anavende:admin-theme";
const preferencia = crearPreferencia(CLAVE);

export type Tema = "light" | "dark";

/**
 * Script que corre ANTES de pintar, para que el panel no aparezca claro y
 * salte a oscuro. Es la única forma de evitar el destello: cualquier efecto
 * de React ya llega tarde.
 */
export const scriptDeTema = `
try {
  var t = localStorage.getItem(${JSON.stringify(CLAVE)});
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
} catch (e) {}
`;

function aplicar(tema: Tema) {
  if (tema === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle({
  className,
  soloIcono = false,
}: {
  className?: string;
  /** Menú colapsado: la etiqueta se retira entera, no se recorta. */
  soloIcono?: boolean;
}) {
  // `null` en el servidor y en la hidratación: todavía no se sabe qué eligió
  // la persona. Con el almacenamiento bloqueado se queda en claro.
  const tema = useSyncExternalStore<Tema | null>(
    preferencia.suscribir,
    () => (preferencia.leer() === "dark" ? "dark" : "light"),
    () => null,
  );

  // Se APLICA, no solo se recuerda. El script de bloqueo de arriba corre
  // una vez, en la primera carga del documento; volver al panel desde la
  // tienda es una navegación de cliente, sin recarga, y ahí el script no
  // vuelve a correr. Sin esto la preferencia queda guardada y desatendida:
  // el panel aparece claro con `dark` en el almacenamiento.
  useEffect(() => {
    if (tema !== null) aplicar(tema);
  }, [tema]);

  // Al salir del panel el atributo se retira: la tienda no hereda el modo
  // oscuro cuando se navega desde acá sin recargar.
  useEffect(
    () => () => document.documentElement.removeAttribute("data-theme"),
    [],
  );

  const cambiar = () => {
    preferencia.escribir(tema === "dark" ? "light" : "dark");
  };

  // Hasta saber qué eligió la persona no se dibuja el estado, para no
  // afirmar uno equivocado durante un instante.
  const esOscuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-pressed={tema === null ? undefined : esOscuro}
      title={soloIcono ? (esOscuro ? "Modo oscuro" : "Modo claro") : undefined}
      className={cn(
        "flex h-9 max-md:h-11 items-center gap-2 rounded-panel-control px-2.5",
        "text-body-sm text-ink-secondary transition-colors duration-150",
        "hover:bg-surface-sunken hover:text-ink",
        soloIcono && "justify-center px-0",
        className,
      )}
    >
      {esOscuro ? (
        <Moon aria-hidden className="size-4 shrink-0" />
      ) : (
        <Sun aria-hidden className="size-4 shrink-0" />
      )}
      {soloIcono ? (
        <span className="sr-only">
          {esOscuro ? "Modo oscuro" : "Modo claro"}
        </span>
      ) : (
        <span className="truncate">
          {esOscuro ? "Modo oscuro" : "Modo claro"}
        </span>
      )}
    </button>
  );
}
