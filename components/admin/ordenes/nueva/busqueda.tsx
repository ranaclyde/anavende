"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";

/** Menos que esto no busca: con una letra coincide medio catálogo. */
const MINIMO = 2;

/**
 * Lo que tienen en común los dos buscadores de la orden —productos y
 * cuentas—, que hasta el 2026-09-30 estaba escrito dos veces.
 *
 * **Una petición por pausa al escribir, no una por tecla.** Y el contador
 * descarta las respuestas que llegan tarde: sin eso, la búsqueda de «tec»
 * puede pisar a la de «teclado» si el servidor contesta en otro orden, y la
 * lista muestra algo que ya no es lo que dice el campo.
 *
 * `buscar` tiene que ser estable —una acción importada, no una función
 * armada en cada render—, porque es dependencia del efecto.
 */
export function useBusqueda<T>(
  termino: string,
  buscar: (q: string) => Promise<T[]>,
) {
  const [resultados, setResultados] = useState<T[]>([]);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    const q = termino.trim();
    if (q.length < MINIMO) {
      ultima.current++;
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    const mia = ++ultima.current;
    const temporizador = setTimeout(async () => {
      const r = await buscar(q);
      if (mia !== ultima.current) return;
      setResultados(r);
      setBuscando(false);
    }, 300);

    return () => clearTimeout(temporizador);
  }, [termino, buscar]);

  return { resultados, buscando };
}

/**
 * El cuerpo de un diálogo de búsqueda: el campo arriba y los resultados
 * abajo, en una zona que **ocupa siempre el mismo alto** y es lo único que
 * scrollea.
 *
 * Es la razón del cambio del 2026-09-30: los dos buscadores pintaban la lista
 * debajo del campo, dentro de la página, y cada búsqueda empujaba el resto
 * del formulario —o de la orden— hacia abajo. Adentro de un diálogo de alto
 * fijo, escribir no mueve nada.
 *
 * El diálogo que lo contiene tiene que tener alto fijo (`ALTO_DEL_DIALOGO`):
 * este cuerpo crece hasta llenarlo, y sin alto la zona de resultados se
 * achicaría y crecería con cada tecla, que es justo lo que se quiere evitar.
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
  /** Lo que se dice antes de escribir: qué se puede buscar. */
  inicial: ReactNode;
  /** Lo que se dice cuando se buscó y no hay nada. */
  vacio: ReactNode;
  /** Los `<li>` de los resultados. */
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
            // Enter busca, no elige ni cierra: quien escribe «teclado» y
            // aprieta Enter está esperando la lista.
            onKeyDown={(ev) => {
              if (ev.key === "Enter") ev.preventDefault();
            }}
            // `admin:pl-9` además de `pl-9`: la escala del panel trae su
            // propio `admin:px-3`, que sin esto le gana y la lupa termina
            // encima del texto.
            className="pl-9 admin:pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      {/* El estado se anuncia: quien usa lector de pantalla no ve la lista
          aparecer (§9). */}
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

/**
 * El alto de los diálogos de búsqueda: fijo, para que la lista no lo haga
 * crecer y achicarse con cada tecla, y nunca más que el tope de §6.14.
 */
export const ALTO_DEL_DIALOGO = "h-[min(40rem,85svh)] sm:max-w-xl";

/** Un renglón de resultados: todo el renglón es el botón. */
export const RENGLON_DE_RESULTADO =
  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-sunken focus-visible:bg-surface-sunken";
