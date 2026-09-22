"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { buscarVariantes } from "@/modules/orders/actions-manual";
import type { VarianteParaLaOrden } from "@/modules/orders/queries-manual";

/**
 * Buscar un producto para agregarlo a una orden — FS RF-24. Tarea F7.4.
 *
 * **Vive aparte del formulario a propósito**: F7.2a (sumar productos a una
 * orden activa) necesita exactamente esto, y esa tarea está planificada
 * después justamente para no escribirlo dos veces.
 *
 * **Busca variantes, no productos**: lo que entra en una orden es un color
 * concreto, y elegir primero el producto y después el color serían dos pasos
 * donde alcanza con uno.
 *
 * **Muestra el disponible de cada uno**, que es el número con el que se
 * decide. Lo dado de baja aparece marcado y se puede elegir igual: una venta
 * a mano puede ser la del último que quedaba de algo que ya se sacó del
 * catálogo — el requisito no la prohíbe y esconderla obligaría a reactivar un
 * producto para poder anotar que se vendió.
 */
export function BuscadorDeVariantes({
  alElegir,
  etiqueta = "Buscar un producto",
  id,
}: {
  alElegir: (variante: VarianteParaLaOrden) => void;
  etiqueta?: string;
  /** Para que el formulario de afuera pueda enfocar acá cuando falta un ítem. */
  id?: string;
}) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<VarianteParaLaOrden[]>([]);
  const [buscando, setBuscando] = useState(false);
  const propio = useId();
  const campo = id ?? propio;

  /**
   * Una petición por pausa al escribir, no una por tecla. Y el contador
   * descarta las respuestas que llegan tarde: sin eso, la búsqueda de «tec»
   * puede pisar a la de «teclado» si el servidor contesta en otro orden, y la
   * lista muestra algo que ya no es lo que dice el campo.
   */
  const ultima = useRef(0);

  useEffect(() => {
    const q = termino.trim();
    if (q.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    const mia = ++ultima.current;
    const temporizador = setTimeout(async () => {
      const r = await buscarVariantes({ q });
      if (mia !== ultima.current) return;
      setResultados(r.ok ? r.data.resultados : []);
      setBuscando(false);
    }, 300);

    return () => clearTimeout(temporizador);
  }, [termino]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={campo} className="text-body-sm font-medium text-ink">
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
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Nombre del producto o marca"
          // Enter acá no envía el formulario de la orden: este campo busca,
          // y quien escribe «teclado» y aprieta Enter está esperando la
          // lista, no cargar una venta a medio llenar.
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

      {/* El estado se anuncia: quien usa lector de pantalla no ve la lista
          aparecer (§9). */}
      <div aria-live="polite" className="sr-only">
        {buscando
          ? "Buscando"
          : resultados.length === 0
            ? ""
            : `${resultados.length} resultados`}
      </div>

      {termino.trim().length >= 2 && !buscando && resultados.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">
          No hay productos que coincidan con «{termino.trim()}».
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="flex max-h-72 flex-col overflow-y-auto rounded-panel-card border border-border bg-surface">
          {resultados.map((v) => (
            <li
              key={v.variantId}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => {
                  alElegir(v);
                  // El campo se vacía al elegir: casi siempre lo que sigue es
                  // buscar otra cosa, y dejar el término anterior obliga a
                  // borrarlo a mano cada vez.
                  setTermino("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-sunken"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm text-ink">
                    {v.nombre}
                    {v.color ? (
                      <span className="text-ink-secondary"> · {v.color}</span>
                    ) : null}
                  </span>
                  <span className="text-caption text-ink-tertiary">
                    {v.marca}
                    {v.inactiva ? " · dado de baja" : ""}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-body-sm text-ink tabular-nums">
                    {formatMoney(v.precio)}
                  </span>
                  <span
                    className={
                      v.disponible > 0
                        ? "block text-caption text-ink-tertiary tabular-nums"
                        : "block text-caption text-danger tabular-nums"
                    }
                  >
                    {v.disponible > 0
                      ? `${v.disponible} disponible${v.disponible === 1 ? "" : "s"}`
                      : "sin stock"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
