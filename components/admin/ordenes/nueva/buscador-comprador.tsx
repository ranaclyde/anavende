"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarCompradores } from "@/modules/orders/actions-manual";
import type { CompradorParaLaOrden } from "@/modules/orders/queries-manual";

/**
 * Asociar la orden a un comprador registrado — FS RF-24. Tarea F7.4.
 *
 * **Es opcional, y el requisito lo dice así**: la orden manual existe
 * justamente para la venta de alguien que no tiene cuenta. Cuando la tiene,
 * asociarla hace que le aparezca en «Mis compras» como cualquier otra.
 *
 * Al elegir una cuenta, el formulario completa el nombre, el teléfono y el
 * email, y ofrece sus direcciones (decisión del 2026-09-16). Todo eso queda
 * editable: lo que se guarda es el snapshot de ESTE pedido, y quien compra
 * para un tercero pone los datos del tercero (F6.1).
 */
export function BuscadorDeComprador({
  elegido,
  alElegir,
  alQuitar,
}: {
  elegido: CompradorParaLaOrden | null;
  alElegir: (comprador: CompradorParaLaOrden) => void;
  alQuitar: () => void;
}) {
  const [termino, setTermino] = useState("");
  const [resultados, setResultados] = useState<CompradorParaLaOrden[]>([]);
  const [buscando, setBuscando] = useState(false);
  const campo = useId();
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
    const id = setTimeout(async () => {
      const r = await buscarCompradores({ q });
      if (mia !== ultima.current) return;
      setResultados(r.ok ? r.data.resultados : []);
      setBuscando(false);
    }, 300);

    return () => clearTimeout(id);
  }, [termino]);

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-panel-card border border-border bg-surface-sunken px-3 py-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-sm font-medium text-ink">
            {elegido.nombre}
          </span>
          <span className="truncate text-caption text-ink-secondary">
            {elegido.email}
          </span>
        </span>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          onClick={() => {
            alQuitar();
            setTermino("");
          }}
        >
          <X aria-hidden />
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
        />
        <Input
          id={campo}
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Buscar por nombre o email"
          // Enter acá no envía el formulario de la orden: este campo busca.
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

      {termino.trim().length >= 2 && !buscando && resultados.length === 0 ? (
        <p className="text-caption text-ink-secondary">
          Nadie con ese nombre o email. La venta se puede cargar igual, sin
          cuenta.
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="flex max-h-56 flex-col overflow-y-auto rounded-panel-card border border-border bg-surface">
          {resultados.map((c) => (
            <li key={c.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  alElegir(c);
                  setTermino("");
                }}
                className="flex w-full flex-col px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-sunken"
              >
                <span className="truncate text-body-sm text-ink">
                  {c.nombre}
                </span>
                <span className="truncate text-caption text-ink-secondary">
                  {c.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
