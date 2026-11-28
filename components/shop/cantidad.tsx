"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Selector de cantidad, de la ficha y del carrito. */
export function Cantidad({
  valor,
  maximo,
  onCambio,
  etiqueta = "Cantidad",
}: {
  valor: number;
  maximo: number;
  onCambio: (n: number) => void;
  /** Lo que anuncia el lector: en el carrito, «Cantidad» sola no dice de qué. */
  etiqueta?: string;
}) {
  const id = useId();
  const acotar = (n: number) => Math.min(Math.max(1, n), maximo);

  return (
    <div className="flex items-center gap-0.5 rounded-pill border border-border bg-surface p-0.5">
      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor <= 1}
        onClick={() => onCambio(acotar(valor - 1))}
      >
        <Minus aria-hidden />
        <span className="sr-only">Quitar uno</span>
      </Button>

      <label className="sr-only" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={maximo}
        value={valor}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          // Un campo vacío se ignora, para no volver a 1 mientras se escribe.
          if (!Number.isNaN(n)) onCambio(acotar(n));
        }}
        className="w-10 bg-transparent text-center text-body font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor >= maximo}
        onClick={() => onCambio(acotar(valor + 1))}
      >
        <Plus aria-hidden />
        <span className="sr-only">Agregar uno</span>
      </Button>
    </div>
  );
}
