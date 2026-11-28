"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
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
 * Selector con buscador para listas que crecen con el catálogo (DR §6.6); las
 * cortas van en `Select`. Filtra acá y no en `cmdk` para respetar el orden de
 * las opciones y comparar sin tildes.
 *
 * Con `crear`, «Crear…» está siempre al final, no solo sin resultados, y se
 * esconde si lo escrito ya existe tal cual.
 *
 * El popover es modal: dentro de un diálogo, uno que no lo es deja la rueda
 * del mouse sin efecto sobre la lista.
 */
export function SelectorConBuscador({
  id,
  valor,
  alCambiar,
  opciones,
  marcador,
  buscar,
  sinResultados,
  crear,
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
  crear?: {
    /** Sin nada escrito: «Crear una marca». */
    nueva: string;
    /** Con lo escrito: «Crear la marca «Sony»». */
    con: (nombre: string) => string;
    alCrear: (nombre: string) => void;
  };
  disabled?: boolean;
  /** Del envoltorio, como en `Select`: para fijarle el ancho. */
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [termino, setTermino] = React.useState("");
  // Al elegir «Crear» el foco no vuelve al selector: se lo lleva el
  // formulario que se abre, y devolverlo acá se lo robaría.
  const creando = React.useRef(false);

  const elegida = opciones.find((o) => o.valor === valor);
  const buscado = normalizar(termino);
  const visibles = buscado
    ? opciones.filter((o) => normalizar(o.etiqueta).includes(buscado))
    : opciones;
  const nombreNuevo = termino.trim();
  const ofrecerCrear =
    !!crear && !opciones.some((o) => normalizar(o.etiqueta) === buscado);

  const abrir = (v: boolean) => {
    setAbierto(v);
    // Un filtro que quedó de la vez anterior escondería opciones sin aviso.
    if (v) {
      setTermino("");
      creando.current = false;
    }
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
        // El ancho del campo, con un piso para los nombres largos.
        className="w-[max(var(--radix-popover-trigger-width),16rem)] p-0"
        onCloseAutoFocus={(e) => {
          if (creando.current) e.preventDefault();
        }}
      >
        <Command
          shouldFilter={false}
          loop
          // Parado sobre lo elegido: Enter sin moverse no cambia nada.
          defaultValue={elegida ? clave(elegida.valor) : undefined}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search
              aria-hidden
              className="size-4 shrink-0 text-ink-secondary"
            />
            {/* Sin anillo de foco propio: el foco llega acá siempre al abrir y
                el globo es el contorno. */}
            <Command.Input
              value={termino}
              onValueChange={setTermino}
              placeholder={buscar}
              className="h-10 min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-secondary focus-visible:shadow-none max-md:h-11"
            />
          </div>
          {/* El scroll va en las opciones para que «Crear» quede siempre a la
              vista; sigue en `Command.List` porque es parte del listbox. */}
          <Command.List className="p-1">
            <div className="max-h-64 overflow-y-auto overscroll-contain">
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
                  className={RENGLON}
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
            </div>
            {crear && ofrecerCrear ? (
              <Command.Item
                value={CLAVE_DE_CREAR}
                onSelect={() => {
                  creando.current = true;
                  setAbierto(false);
                  crear.alCrear(nombreNuevo);
                }}
                className={cn(
                  RENGLON,
                  // Separado de las opciones: no es una de ellas.
                  visibles.length > 0 &&
                    "relative mt-1 before:absolute before:inset-x-0 before:-top-0.5 before:h-px before:bg-border",
                )}
              >
                <Plus aria-hidden className="size-4 shrink-0 text-ink" />
                <span className="min-w-0 flex-1 font-medium">
                  {nombreNuevo ? crear.con(nombreNuevo) : crear.nueva}
                </span>
              </Command.Item>
            ) : null}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const RENGLON = cn(
  "flex min-h-9 cursor-default select-none items-center gap-2 rounded-[6px] px-2 py-1.5 text-body-sm text-ink outline-none max-md:min-h-11",
  "data-[selected=true]:bg-surface-sunken",
  "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
);

/** Otro prefijo que el de las opciones: ninguna puede chocar con él. */
const CLAVE_DE_CREAR = "crear";

/**
 * No puede ser el valor a secas: «Todas las categorías» vale `""`, y `cmdk`
 * toma una clave vacía como «usá el texto del renglón».
 */
function clave(valor: string): string {
  return `opcion:${valor}`;
}
