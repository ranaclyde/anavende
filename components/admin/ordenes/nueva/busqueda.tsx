"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";

/** Menos que esto no busca: con una letra coincide medio catálogo. */
const MINIMO = 2;

/**
 * Una petición por pausa al escribir. El contador descarta las respuestas
 * tardías: si no, «tec» puede pisar a «teclado».
 *
 * `buscar` tiene que ser estable (una acción importada): es dependencia del
 * efecto.
 */
export function useBusqueda<T>(
  termino: string,
  buscar: (q: string) => Promise<T[]>,
) {
  const q = termino.trim();
  const corto = q.length < MINIMO;

  // «Buscando» se deduce de que el término de la respuesta no sea el de ahora.
  const [respuesta, setRespuesta] = useState<{ q: string; resultados: T[] }>({
    q: "",
    resultados: [],
  });
  const ultima = useRef(0);

  // En el render y no en el efecto, que pintaría primero la lista vieja.
  if (corto && (respuesta.q !== "" || respuesta.resultados.length > 0)) {
    setRespuesta({ q: "", resultados: [] });
  }

  useEffect(() => {
    // Lo que estuviera en vuelo ya no corresponde a lo que dice el campo.
    const mia = ++ultima.current;
    if (corto) return;

    const temporizador = setTimeout(async () => {
      const r = await buscar(q);
      if (mia !== ultima.current) return;
      setRespuesta({ q, resultados: r });
    }, 300);

    return () => clearTimeout(temporizador);
  }, [q, corto, buscar]);

  return {
    resultados: respuesta.resultados,
    buscando: !corto && respuesta.q !== q,
  };
}

/**
 * El diálogo que lo contiene tiene que tener alto fijo (`ALTO_DEL_DIALOGO`):
 * si no, la zona de resultados crece y se achica con cada tecla.
 */
export function CuerpoDeBusqueda({
  campo,
  etiqueta,
  placeholder,
  termino,
  alCambiar,
  buscando,
  cantidad,
  inicial,
  vacio,
  children,
}: {
  campo: string;
  etiqueta: string;
  placeholder: string;
  termino: string;
  alCambiar: (termino: string) => void;
  buscando: boolean;
  cantidad: number;
  /** Lo que se dice antes de escribir. */
  inicial: ReactNode;
  vacio: ReactNode;
  children: ReactNode;
}) {
  const q = termino.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={campo} className="sr-only">
          {etiqueta}
        </label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
          />
          <Input
            id={campo}
            value={termino}
            onChange={(e) => alCambiar(e.target.value)}
            placeholder={placeholder}
            // Enter no envía el formulario: se está esperando la lista.
            onKeyDown={(ev) => {
              if (ev.key === "Enter") ev.preventDefault();
            }}
            // `admin:pl-9`: si no, el `admin:px-3` del panel le gana y la lupa
            // queda encima del texto.
            className="pl-9 admin:pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Se anuncia a lectores de pantalla (§9). */}
      <div aria-live="polite" className="sr-only">
        {buscando ? "Buscando" : cantidad === 0 ? "" : `${cantidad} resultados`}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel-card border border-border">
        {cantidad > 0 ? (
          <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </ul>
        ) : (
          <p className="m-auto max-w-xs px-4 text-center text-body-sm text-ink-secondary">
            {q.length < MINIMO ? inicial : buscando ? "Buscando…" : vacio}
          </p>
        )}
      </div>
    </div>
  );
}

/** Fijo, y nunca más que el tope de DR §6.14. */
export const ALTO_DEL_DIALOGO = "h-[min(40rem,85svh)] sm:max-w-xl";

export const RENGLON_DE_RESULTADO =
  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-sunken focus-visible:bg-surface-sunken";
