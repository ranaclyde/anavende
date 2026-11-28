"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { createPreference } from "@/lib/local-preference";
import { cn } from "@/lib/utils";

/**
 * Modo oscuro del panel — DR §3.2. Solo existe en /admin: no se usa una
 * biblioteca de temas porque escriben en `<html>` y se quedan pegadas al
 * salir del panel. Un atributo se pone al entrar y se saca al irse.
 */

const CLAVE = "anavende:admin-theme";
const preferencia = createPreference(CLAVE);

export type Tema = "light" | "dark";

/**
 * Corre antes de pintar, para que el panel no aparezca claro y salte a
 * oscuro: un efecto de React ya llega tarde.
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
    preferencia.subscribe,
    () => (preferencia.read() === "dark" ? "dark" : "light"),
    () => null,
  );

  // Se aplica, no solo se recuerda: volver al panel desde la tienda es una
  // navegación de cliente y el script de arriba no vuelve a correr.
  useEffect(() => {
    if (tema !== null) aplicar(tema);
  }, [tema]);

  // Al salir del panel se retira, o la tienda hereda el modo oscuro.
  useEffect(
    () => () => document.documentElement.removeAttribute("data-theme"),
    [],
  );

  const cambiar = () => {
    preferencia.write(tema === "dark" ? "light" : "dark");
  };

  // Hasta saber qué eligió la persona no se dibuja el estado.
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
