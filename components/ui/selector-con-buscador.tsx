"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizar } from "@/lib/texto";
import { cn } from "@/lib/utils";

export type OpcionDelSelector = {
  valor: string;
  etiqueta: string;
  /** Va al lado, en tinta secundaria: «inactiva», «ya cargado». */
  nota?: string;
  deshabilitada?: boolean;
  /** Lo que va a la izquierda del nombre: la esfera de un color. */
  muestra?: React.ReactNode;
};

/**
 * Selector de una opción con buscador — DESIGN-REFERENCE §6.6. Tarea F2.11.
 *
 * **Convive con `Select`, no lo reemplaza.** El `<select>` del navegador
 * sigue siendo lo correcto para las listas cortas —estado, rol, orden—: en el
 * teléfono abre la rueda nativa. Este va donde la lista crece sin techo
 * —marcas, categorías, colores— y donde cada opción necesita mostrar algo
 * más que texto: la rueda nativa no busca por una parte del nombre ni sabe
 * pintar un color.
 *
 * El teclado y el lector de pantalla los pone `cmdk` (flechas, Enter,
 * Escape, `aria-activedescendant`), que era el motivo para no hacer un menú
 * propio. La lista se filtra acá y no en `cmdk`: así respeta el orden en que
 * llegan las opciones —activas primero, de la A a la Z— y compara sin tildes,
 * igual que el buscador de la tienda.
 *
 * **El popover es modal.** Dentro de un diálogo, uno que no lo es deja la
 * rueda del mouse sin efecto sobre la lista: el diálogo bloquea el scroll de
 * todo lo que no sea suyo, y el globo va por portal, afuera del diálogo.
 */
export function SelectorConBuscador({
  id,
  valor,
  alCambiar,
  opciones,
  marcador,
  buscar,
  sinResultados,
  disabled,
  className,
  ...aria
}: {
  id?: string;
  valor: string;
  alCambiar: (valor: string) => void;
  opciones: readonly OpcionDelSelector[];
  /** Lo que dice cuando no hay nada elegido: «Elegí una marca». */
  marcador: string;
  /** El marcador del buscador: «Buscar una marca…». */
  buscar: string;
  /** «No hay ninguna marca con ese nombre.» */
  sinResultados: string;
  disabled?: boolean;
  /** Del envoltorio, como en `Select`: para fijarle el ancho. */
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [termino, setTermino] = React.useState("");

  const elegida = opciones.find((o) => o.valor === valor);
  const buscado = normalizar(termino);
  const visibles = buscado
    ? opciones.filter((o) => normalizar(o.etiqueta).includes(buscado))
    : opciones;

  const abrir = (v: boolean) => {
    setAbierto(v);
    // Cada vez que se abre, la lista arranca entera: un filtro que quedó de
    // la vez anterior escondería las opciones sin que se note por qué.
    if (v) setTermino("");
  };

  return (
    <Popover open={abierto} onOpenChange={abrir} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          // `aria-expanded` y `aria-controls` los pone `PopoverTrigger` al
          // pintar; la regla de lint mira el JSX y no los ve.
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
          role="combobox"
          disabled={disabled}
          {...aria}
          className={cn(
            "flex h-12 w-full items-center gap-2 rounded-pill border border-border bg-surface pl-4 pr-3 text-left text-body text-ink",
            "transition-colors duration-150",
            "focus:border-border-strong data-[state=open]:border-border-strong",
            "aria-invalid:border-danger",
            "disabled:cursor-not-allowed disabled:opacity-40",
            "admin:h-10 admin:max-md:h-11 admin:rounded-panel-control admin:pl-3 admin:text-body-sm",
            className,
          )}
        >
          {elegida ? (
            <>
              {elegida.muestra}
              <span className="min-w-0 flex-1 truncate">
                {elegida.etiqueta}
                {elegida.nota ? (
                  <span className="text-ink-secondary"> ({elegida.nota})</span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-ink-secondary">
              {marcador}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-ink-secondary"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        // El ancho del campo, con un piso: en el filtro del listado el campo
        // mide 192px y un nombre largo no entraría.
        className="w-[max(var(--radix-popover-trigger-width),16rem)] p-0"
      >
        <Command
          shouldFilter={false}
          loop
          // Arranca parado sobre lo elegido, así Enter sin moverse no cambia
          // nada y la lista ya está scrolleada hasta ahí.
          defaultValue={elegida ? clave(elegida.valor) : undefined}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search
              aria-hidden
              className="size-4 shrink-0 text-ink-secondary"
            />
            {/* Sin anillo de foco propio: el foco llega acá siempre, al abrir,
                y el globo entero ya es el contorno. El cursor titilando es la
                señal. */}
            <Command.Input
              value={termino}
              onValueChange={setTermino}
              placeholder={buscar}
              className="h-10 min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-secondary focus-visible:shadow-none max-md:h-11"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto overscroll-contain p-1">
            <Command.Empty className="px-2 py-6 text-center text-body-sm text-ink-secondary">
              {sinResultados}
            </Command.Empty>
            {visibles.map((o) => (
              <Command.Item
                key={o.valor}
                value={clave(o.valor)}
                disabled={o.deshabilitada}
                onSelect={() => {
                  alCambiar(o.valor);
                  setAbierto(false);
                }}
                className={cn(
                  "flex min-h-9 cursor-default select-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-body-sm text-ink outline-none max-md:min-h-11",
                  "data-[selected=true]:bg-surface-sunken",
                  "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
                )}
              >
                {o.muestra}
                <span className="min-w-0 flex-1">
                  {o.etiqueta}
                  {o.nota ? (
                    <span className="text-ink-secondary"> ({o.nota})</span>
                  ) : null}
                  {/* `aria-selected` es de `cmdk` y marca el renglón parado,
                      no el elegido: el tilde se dice en texto. */}
                  {o.valor === valor ? (
                    <span className="sr-only"> (la actual)</span>
                  ) : null}
                </span>
                <Check
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-ink",
                    o.valor === valor ? "opacity-100" : "opacity-0",
                  )}
                />
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * La clave de `cmdk` para una opción. No puede ser el valor a secas: la
 * opción «Todas las categorías» vale `""`, y `cmdk` toma una clave vacía como
 * «usá el texto del renglón».
 */
function clave(valor: string): string {
  return `opcion:${valor}`;
}
